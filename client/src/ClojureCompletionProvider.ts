import vscode = require('vscode');
import nrepl_client = require('jg-nrepl-client');
import edn = require('jsedn');
import {EditorUtils} from './editorUtils';
import {CompletionUtils} from './completionUtils';
let chalk = require("chalk");

export class ClojureCompletionItemProvider implements vscode.CompletionItemProvider {
  
  private connection: nrepl_client.Connection;

  constructor(conn: nrepl_client.Connection) {
    this.connection = conn;
  }
  
  private completionsContext(document: vscode.TextDocument, position: vscode.Position) : string {
    let context = `(defn fun
     [yyy]
     __prefix__)`
    return context;
  }
  
  private completionsCode(document: vscode.TextDocument, position: vscode.Position): string {
    let fileContents = document.getText();
    var regex = /\(ns\s+?(.*?)(\s|\))/;
    var ns = regex.exec(fileContents.toString())[1];
    // Get the term
    let prefixRange = document.getWordRangeAtPosition(position);
    let prefix = document.getText(prefixRange);
    let offset = document.offsetAt(position) - 1;
    var src = fileContents.substring(0, offset) + "__prefix__" + fileContents.substring(offset + prefix.length);
    src = EditorUtils.escapeClojureCodeInString(src);
    
    let rval = 
    `(do (require 'compliment.core)
     (defn make-proxy
      [reader count-atom]
      (proxy [java.io.PushbackReader clojure.lang.IDeref] [reader]
       (deref [] @count-atom)
       (read [] (do (swap! count-atom inc) (proxy-super read)))
       (unread [c] (do (swap! count-atom dec) (proxy-super unread c)))))
       
     (defn find-high-level-form
      [src position]
      (let[rdr (make-proxy (java.io.StringReader. src) (atom 0))]
       (loop [form (read rdr) pos @rdr]
        (if (> pos position)
         form
         (recur (read rdr) @rdr)))))
       
     (let [src ${src}
           pos ${offset}
           ctx (str (find-high-level-form src pos))]
      (let [completions (compliment.core/completions
                         \"${prefix}\"
                         {:tag-candidates true
                          :ns '${ns}
                          :context ctx})]
        (->> completions
             (take 50)
             (mapv #(assoc % :docs (compliment.core/documentation
                                    (:candidate %) '${ns})))))))`;
    return rval;
  }
  
  
  
	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
    let self = this;
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      // Get the namespace for this document
      
      //let command = "(completions \"" + term +  "\" {:tag-candidates true :context " + ctx + "})";
      let command = self.completionsCode(document, position);

      // Call Compliment to get the completions
      //self.connection.eval("(use '" + ns  + ")", (err: any, result: any) => {
        
        // TODO add context
        self.connection.eval(command, (cErr: any, cResult: any) => {
          if (cResult) {
            let results = CompletionUtils.complimentResultsToCompletionItems(cResult[0]["value"]);
            
            resolve(results);
          } else {
            reject(cErr);
          }
        });
			//});
      
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