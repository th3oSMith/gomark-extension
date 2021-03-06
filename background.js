
/*jshint esnext: true */


class BookmarkStore {

  constructor() {
    this.bookmarks = new Map();
    this.orderedBookmarks = [];
    this.tabs = new Map();
    this.criteria = {};

    this.reset();
  }

  reset() {

    this.bookmarks.clear();
    this.orderedBookmarks = [];
    this.criteria = {
      tags: ['toread']
    };

    return gomark.get("").then((r) => {
      for (var url in r) {
        let bookmark = r[url];
        bookmark.Date = new Date(bookmark.Date);
        this.bookmarks.set(url, bookmark);
        this.orderedBookmarks.push(bookmark);
      }
       this.orderedBookmarks.sort((a, b) => {return b.Date - a.Date;});
    });
  }

  add(b) {
    if (this.bookmarks.has(b.Url)) {
      this.bookmarks.set(b.Url, b);
      
      for (var i in this.orderedBookmarks) {
        if (this.orderedBookmarks[i].Url === b.Url) {
          this.orderedBookmarks[i] = b;
        }
      }
    } else {
      this.bookmarks.set(b.Url, b);
      this.orderedBookmarks.unshift(b);
    }
  }

  has(url) {
    return this.bookmarks.has(url);
  }

  getToRead() {

    let books = [];

    for (var b of this.orderedBookmarks) {
      if (b.Tags.toread) {
        books.push(b);
      }
    }

    return books;

  }

  getByCriteria() {

    let criteria = this.criteria.tags;

    if (this.criteria.length === 0) {
      return this.orderedBookmarks;
    }

    return this.getSearch(criteria);
  }

  getSearch(tags) {

    let books = [];

    for (var b of this.orderedBookmarks) {
      let count = 0;


      for (var t of tags) {
        if (b.Tags[t] || b.Title.toLowerCase().includes(t.toLowerCase())) {
          count++;
        }
      }

      if (count === tags.length) {
        books.push(b);
      }
    }
    return books;
  }

  del(url) {

  
    if (!this.bookmarks.has(url)) {
      return;
    }

    this.bookmarks.delete(url);

    for (var i in this.orderedBookmarks) {
      if (this.orderedBookmarks[i].Url === url) {
        this.orderedBookmarks.splice(i, 1);
        return;
      }
    }
  }
}



function tabUpdate(tabId, changeInfo) {

  if (!changeInfo.url) {
    return;
  }

  let ok = gomark.get(changeInfo.url);
  ok.then(createIconSetter(tabId, "icons/toread-32.png", changeInfo.url, true),
          createIconSetter(tabId, "icons/read-32.png", changeInfo.url, false));

  chrome.pageAction.show(tabId);
}

function tabLightUpdate(info) {

  const tab = browser.tabs.get(info.tabId);
  tab.then((r) => {
    if (store.has(r.url)) {
      chrome.pageAction.setIcon({tabId: r.id, path: "icons/toread-32.png"});
      chrome.pageAction.show(r.id);
    } else {
      chrome.pageAction.setIcon({tabId: r.id, path: "icons/read-32.png"});
      chrome.pageAction.show(r.id);
    }
  });

}

function pageActionClicked(tab) {

  let ok;
  
  if (!store.has(tab.url)) {
    ok = gomark.add(tab.url, ["toread"]);
    chrome.pageAction.setIcon({tabId: tab.id, path: "icons/toread-32.png"});
    ok.then(createIconSetter(tab.id, "icons/toread-32.png", tab.url, true),
            createIconSetter(tab.id, "icons/read-32.png", tab.url, false));
  } else {
    ok = gomark.del(tab.url);
    chrome.pageAction.setIcon({tabId: tab.id, path: "icons/read-32.png"});
    ok.then(createIconSetter(tab.id, "icons/read-32.png", tab.url, false),
            createIconSetter(tab.id, "icons/toread-32.png", tab.url, true));
  }
}

function createIconSetter(tabId, path, url, set) {
  return function (r) {

    chrome.pageAction.setIcon({tabId, path});
    chrome.pageAction.show(tabId);

    if (set) {
      store.add(r[url]);
    } else {
      store.del(url);
    }
  };
}


function perform(message, sender, responseSender) {

  switch (message.action) {
    case "list":
      store.criteria = {tags: message.tags};
      if (message.reset) {
        store.reset().then((r) => {
          chrome.notifications.create({
            type: "basic",
            title: "Gomark",
            message: "Links updated"
          });
          responseSender(store.getByCriteria());
        });
        return true;
      }
      responseSender(store.getByCriteria());
      break;
    case "read":
      gomark.edit(message.url, [], [], ["toread"]).then((r) => {
        store.add(r[message.url]);
        responseSender(store.getByCriteria());
      }, (r) => {
        responseSender(store.getByCriteria());
      });
      break;
    case "search":
      store.criteria = {tags: message.tags};
      responseSender(store.getByCriteria());
      break;
    case "add":
      gomark.add(message.url, message.tags).then((r) => {
        store.add(r[message.url]);
        browser.tabs.query({url: message.url}, (tabs) => {
          for (var t of tabs) {
            chrome.pageAction.setIcon({tabId: t.id, path: "icons/toread-32.png"});
          }
        });
        responseSender(store.getByCriteria());
      }, (r) => {
        responseSender(store.getByCriteria());
      });
      break;
    case "edit":
      gomark.edit(message.url, message.tags, [], ["toread"]).then((r) => {
        store.add(r[message.url]);
        responseSender(store.getByCriteria());
      }, (r) => {
        responseSender(store.getByCriteria());
      });
      break;
    case "delete":
      gomark.del(message.url).then((r) => {
        store.del(message.url);
        browser.tabs.query({url: message.url}, (tabs) => {
          for (var t of tabs) {
            chrome.pageAction.setIcon({tabId: t.id, path: "icons/read-32.png"});
          }
        });
        responseSender(store.getByCriteria());
      }, (r) => {
        responseSender(store.getByCriteria());
      });
      break;
    case "init":
      init(message.options);
      break;
  }

  return true;

}

browser.tabs.onUpdated.addListener(tabUpdate);
browser.tabs.onActivated.addListener(tabLightUpdate);
browser.pageAction.onClicked.addListener(pageActionClicked);
browser.runtime.onMessage.addListener(perform);

let gomark, store;

function init(options) {

  browser.notifications.onClicked.addListener((id) => {
    if (id === 'noServer') {
      browser.runtime.openOptionsPage();
    }
  })

  if (options === null || options.url === '') {
    tmp = chrome.notifications.create('noServer', {
      type: "basic",
      title: "Gomark - Error",
      message: "You need to configure the server in the options (click to open)"
    });

    tmp.then((ok) => {
      console.log('notif OK');
    }, (err) => {
      console.log('notif KO', err);
    });
  }

  if (options.username !== '') {
    gomark = new Gomark(options.url, options.username, options.password);
  } else {
    gomark = new Gomark(options.url);
  }

  store = new BookmarkStore();
}

browser.storage.local.get('options').then((res) => {
  init(res.options);
}, (err) => {
  init(null);
});


