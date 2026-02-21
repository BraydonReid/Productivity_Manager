import type { ExtensionMessage } from './types';

export function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage<T>(
  tabId: number,
  message: ExtensionMessage
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}
