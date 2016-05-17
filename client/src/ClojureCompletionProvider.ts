import vscode = require('vscode');
import nrepl_client = require('jg-nrepl-client');
import edn = require('jsedn');

export class ClojureCompletionItemProvider implements vscode.CompletionItemProvider {
  
  private connection: nrepl_client.Connection;

  constructor(conn: nrepl_client.Connection) {
    this.connection = conn;
  }
  
	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
    let self = this;
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      // Get the namespace for this document
      let fileContents = document.getText();
      var regex = /\(ns\s+?(.*?)(\s|\))/;
      var ns = regex.exec(fileContents.toString())[1];
      // Get the term
      let termRange = document.getWordRangeAtPosition(position);
      let term = document.getText(termRange);
      
      // Call Compliment to get the completions
      self.connection.eval("(use '" + ns  + ")", (err: any, result: any) => {
				// TODO move code into here so we can wait for this eval to finish
        self.connection.eval("(completions \"" + term +  "\" {:tag-candidates true})", (cErr: any, cResult: any) => {
          if (cResult) {
            var res = edn.parse(cResult[0]["value"]);
            
            let results = res.each((candidateMap: any) => {
              let candidate: string = candidateMap.at(edn.kw(":candidate"));
              return new vscode.CompletionItem(candidate);
            });
            
            resolve(results);
          } else {
            reject(cErr);
          }
        });
			});
      
      // let a = [
      //   new vscode.CompletionItem("Clojure"),
      //   new vscode.CompletionItem("Elixir")  
      // ];
      
      // let aa = [
			// 		{
			// 			label: 'Clojure',
			// 			kind: vscode.CompletionItemKind.Text,
			// 			data: 1
			// 		},
			// 		{
			// 			label: 'Elixir',
			// 			kind: vscode.CompletionItemKind.Text,
			// 			data: 2
			// 		}
			// 	]
      // resolve(a);
    });
  }
}