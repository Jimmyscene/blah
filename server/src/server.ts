import {
    createConnection,
    TextDocuments,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams
} from 'vscode-languageserver'

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also includes all preview/proposed LSP features
let connection = createConnection(ProposedFeatures.all)

// create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDianosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;

    // Does the client support the 'workspace/configuration' request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = capabilities.workspace && !!capabilities.workspace.configuration
    hasWorkspaceFolderCapability = capabilities.workspace && !!capabilities.workspace.workspaceFolders
    hasDianosticRelatedInformationCapability = capabilities.textDocument && capabilities.textDocument.publishDiagnostics && capabilities.textDocument.publishDiagnostics.relatedInformation;
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: true
            }
        }
    }
})

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        )
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.')
        })
    }
})


// The example settings
interface ExampleSettings {
    maxNumberOfProblems: number
}

// The global settings, used when the 'workspace/configuration' request i snot supported by the client
// Please note that this is not the case when using this server with the client provided in the example
// but could happen with other clients
const defaultSettings: ExampleSettings = {maxNumberOfProblems: 10000}
let globalSettings: ExampleSettings = defaultSettings

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map()

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear()
    } else {
        globalSettings = <ExampleSettings>(
            (change.settings.pythonLanguageServer || defaultSettings)
        )
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument)
})

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!hasConfigurationCapability) {
        console.log("No Configuration settings")
        return Promise.resolve(globalSettings)
    }
    let result = documentSettings.get(resource)
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'pythonLanguageServer'
        })
        documentSettings.set(resource, result)
    }
    return result
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri)
})

// The content of a text document has changed. THis event is emitted
// when the text document first opened or when its content has changed
documents.onDidChangeContent(change => {
    validateTextDocument(change.document)
})


async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this example we get the settings for every validate run
    let settings = await getDocumentSettings(textDocument.uri)
    // the validator creates diagnostics for all uppercase words length 2 and more
    let text = textDocument.getText()
    console.log(text)
    let pattern = /purple\shair\sis\s((?!fabulous).*)/g
    let m: RegExpExecArray
    let problems = 0
    let diagnostics: Diagnostic[] = []
    while ((m = pattern.exec(text)) && (problems < settings.maxNumberOfProblems)) {
        problems++
        let diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
                start: textDocument.positionAt(m.index),
                end: textDocument.positionAt(m.index + m[0].length)
            },
            message: `incorrect syntax ${m[0]}`,
            source: 'ex'
        }
        if (hasDianosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: "Did you mean 'fabulous'?"
                },
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: "Or are you a hater?"
                }
            ]
        }
        diagnostics.push(diagnostic)
    }
    connection.sendDiagnostics({uri: textDocument.uri, diagnostics})

}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received a file change event')
})

// This handler provides the initial list of completion items
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass paramter contains the position of the text document in
        // which code complete got resquested. For the example
        // we ignore this info and always provide the same completion items
        return [
            {
                label: 'TypeScript',
                kind: CompletionItemKind.Text,
                data: 1
            },
            {
                label: 'JavaScript',
                kind: CompletionItemKind.Text,
                data: 2
            }
            ];
    }
)


// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
