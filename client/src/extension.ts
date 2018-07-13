import * as path from 'path'
import {workspace, ExtensionContext } from 'vscode'

// const languageType: string = "plaintext"
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient'

let client : LanguageClient

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    )

    // The debug options for the server
    // --inspect 6089 runs the server in node's inspector mode so VS Code can attach to the server for debugging
    let debuggingOptions = {
        execArgv: [
            '--nolazy', '--inspect=6089'
        ]
    }

    // if the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debuggingOptions
		}
	};


    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{scheme: "file", language: 'plaintext' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    }

    // Creat ethe language client and start the client
    client = new LanguageClient(
        'pythonLanguageServer',
        'Python Language Server',
        serverOptions,
        clientOptions
    )
    // Start the client, this will also launch the server
    client.start()
}

export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined
    }
    return client.stop()
}

