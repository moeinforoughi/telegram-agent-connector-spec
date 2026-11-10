export function isTrustedSender(
  senderId: number,
  isMainFrame: boolean,
  expectedSenderId: number,
  senderUrl: string | null,
  expectedUrl: string,
): boolean {
  return (
    senderId === expectedSenderId && isMainFrame && senderUrl !== null && senderUrl === expectedUrl
  );
}
