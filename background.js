chrome.commands.onCommand.addListener(async (command) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https:\/\/www\.youtube\.com\//.test(tab.url || '')) return;
  try {
    if (command === 'set-start') {
      const info = await chrome.tabs.sendMessage(tab.id, { action: 'GET_VIDEO_INFO' });
      if (info?.isWatchPage) await chrome.tabs.sendMessage(tab.id, { action: 'SET_START_FROM_COMMAND', time: info.currentTime });
    } else if (command === 'set-end') {
      await chrome.tabs.sendMessage(tab.id, { action: 'SET_END_FROM_COMMAND' });
    } else if (command === 'toggle-loop') {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_LOOP' });
    }
  } catch (error) {
    console.debug('[ClipLooper background]', error);
  }
});