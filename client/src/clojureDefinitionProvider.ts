import {DefinitionProvider, Definition, Location, TextDocument, Position, Uri, CancellationToken} from 'vscode';
import nrepl_client = require('jg-nrepl-client');
import edn = require('jsedn');
import {EditorUtils} from './editorUtils';
import {CompletionUtils} from './completionUtils';
let chalk = require("chalk");

export class ClojureDefinitionProvider implements DefinitionProvider {

  private connection: nrepl_client.Connection;

  constructor(conn: nrepl_client.Connection) {
    this.connection = conn;
  }

  public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Definition> {
    let self = this;
    return new Promise<Definition>((resolve, reject) => {
      let wordRange = document.getWordRangeAtPosition(position);
      let symbol = document.getText(wordRange);
      // TODO Maybe change this to use the System temp dir instead of one under ~/.lein
      let command = `(do (require 'clojure.repl)
                        (require 'clojure.java.shell)
                        (require 'clojure.java.io)
                        (let [var-sym '${symbol}
                              the-var (or (some->> (or (get (ns-aliases *ns*) var-sym) (find-ns var-sym))
                                                  clojure.repl/dir-fn
                                                  first
                                                  name
                                                  (str (name var-sym) "/")
                                                  symbol)
                                          var-sym)
                              {:keys [file line]} (meta (eval \`(var ~the-var)))
                              file-path (.getPath (.getResource (clojure.lang.RT/baseLoader) file))]
                          (if-let [[_
                                    jar-path
                                    partial-jar-path
                                    within-file-path] (re-find #"file:(.+/\\.m2/repository/(.+\\.jar))!/(.+)" file-path)]
                            (let [decompressed-path (str (System/getProperty "user.home")
                                                        "/.lein/tmp-atom-jars/"
                                                        partial-jar-path)
                                  decompressed-file-path (str decompressed-path "/" within-file-path)
                                  decompressed-path-dir (clojure.java.io/file decompressed-path)]
                              (when-not (.exists decompressed-path-dir)
                                (println "decompressing" jar-path "to" decompressed-path)
                                (.mkdirs decompressed-path-dir)
                                (clojure.java.shell/sh "unzip" jar-path "-d" decompressed-path))
                              [decompressed-file-path line])
                            [file-path line])))`;
      // Use the REPL to find the definition point
      self.connection.eval(command, (cErr: any, cResult: any) => {
        if (cResult && cResult.length > 0) {
          var def: Location[] = [];
          let results = cResult[0]["value"];
          if (results != null) {
            let res = edn.parse(results);
            let uri = Uri.file(res.at(0));
            let line = res.at(1);
            let pos = new Position(line, 0);
            def = [new Location(uri, pos)];
          }

          resolve(def);
        } else {
          reject(cErr);
        }
      });
    });
  }
}