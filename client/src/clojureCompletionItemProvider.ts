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
  
  private completionsCode(document: vscode.TextDocument, position: vscode.Position): string {
    let fileContents = document.getText();
    var regex = /\(ns\s+?(.*?)(\s|\))/;
    var ns = regex.exec(fileContents.toString())[1];
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
       (loop [form (binding [*read-eval* false] (read rdr)) pos @rdr]
        (if (> pos position)
         form
         (recur (binding [*read-eval* false] (read rdr)) @rdr)))))
       
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
      
      let command = self.completionsCode(document, position);

      // Call Compliment to get the completions
      self.connection.eval(command, (cErr: any, cResult: any) => {
        if (cResult && cResult.length > 0) {
          let results = CompletionUtils.complimentResultsToCompletionItems(cResult[0]["value"]);
          if (results != null) {
            resolve(results);
          } else {
            resolve([]);
          }
        } else {
          reject(cErr);
        }
      });
    });
  }
}