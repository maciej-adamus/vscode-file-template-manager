import * as vscode from 'vscode';
import { decode as qsDecode } from 'querystring';

import {
  createTemplate,
  getTemplate,
  removeTemplate,
  updateTemplate,
} from './templates';

export default class FileTemplateManagerFileSystemProvider implements vscode.FileSystemProvider {
  onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  onDidChangeFile = this.onDidChangeFileEmitter.event;

  private bufferedEvents: vscode.FileChangeEvent[] = [];

  private eventEmitTimeoutHandle: NodeJS.Timeout | null = null;

  private emitEvent(event: vscode.FileChangeEvent): void {
    this.bufferedEvents.push(event);

    if (this.eventEmitTimeoutHandle) {
      clearTimeout(this.eventEmitTimeoutHandle);
    }

    this.eventEmitTimeoutHandle = setTimeout(
      () => {
        this.onDidChangeFileEmitter.fire(this.bufferedEvents);
        this.bufferedEvents = [];
        this.eventEmitTimeoutHandle = null;
      },
      10,
    );
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const { name } = qsDecode(uri.query) as { name: string, ext: string };
    return getTemplate(name)?.content || new Uint8Array();
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
  ): Promise<void> {
    const { name, ext } = qsDecode(uri.query) as { name: string, ext: string };

    const template = getTemplate(name);

    if (!template) {
      await createTemplate(name, ext);
      this.emitEvent({ type: vscode.FileChangeType.Created, uri });
    }

    await updateTemplate(name, content);
    this.emitEvent({ type: vscode.FileChangeType.Changed, uri });
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const { name } = qsDecode(uri.query) as { name: string };
    const template = getTemplate(name);

    return {
      ctime: template?.ctime || Date.now(),
      mtime: template?.mtime || Date.now(),
      size: template?.content.byteLength || 0,
      type: vscode.FileType.File,
    };
  }

  async delete(uri: vscode.Uri): Promise<void> {
    const { name } = qsDecode(uri.query) as { name: string };
    await removeTemplate(name);
    this.emitEvent({ type: vscode.FileChangeType.Deleted, uri });
  }

  watch(): vscode.Disposable {
    // Ignore. Events are fired.
    return new vscode.Disposable(() => null);
  }

  copy(): void {
    // Ignore. Cannot copy templates.
  }

  createDirectory(): void {
    // Ignore. Cannot create template directories.
  }

  readDirectory(): [string, vscode.FileType][] {
    // Ignore. Cannot create template directories.
    return [];
  }

  rename(): void {
    // Ignore. Cannot rename a template.
  }
}
