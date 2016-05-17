/// <reference path="../node_modules/vscode/typings/node.d.ts" />
declare module "jg-nrepl-client" {
	export interface Connection {
		sessions: [any];
		send(mesg: any, callback: (err: any, result: any) => void): void;
		eval(code: string, callback: (err: any, result: any) => void): string;

	}
	export function connect(opts: any): Connection;
}
