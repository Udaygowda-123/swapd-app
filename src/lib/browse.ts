// Set when a signed-out visitor taps "Just browse" on the welcome screen, so we don't bounce them back there.
let browsing = false;
export const isBrowsing = () => browsing;
export const startBrowsing = () => { browsing = true; };
