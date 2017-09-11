/*jshint esnext: true */
/*jshint elision: true */

class Panel {

  constructor(linkPerPage=8) {
    this.lpp = linkPerPage;
    this.links = [];
    this.numPages = 0;
    this.currentPage = 0;
  }

  setLinks(links) {
    this.numPages = Math.ceil(links.length / this.lpp);

    this.numPages = Math.max(1, this.numPages);

    this.links = links;
    this.currentPage = 0;
  }

  getCurrentPage() {
    let x = this.currentPage;
    return this.links.slice(x * this.lpp, Math.min(this.links.length, (x + 1) * this.lpp));
  }

  nextPage() {
    this.currentPage = Math.min(this.numPages - 1, this.currentPage + 1);
  }

  previousPage() {
    this.currentPage = Math.max(0, this.currentPage - 1);
  }

  draw() {
    var list = document.getElementById('list');
    while (list.firstChild) {
        list.removeChild(list.firstChild);
    }

    const entries = this.getCurrentPage();

    for (var bookmark of entries) {
        const url = bookmark.RawUrl;
        list.appendChild(createListElement(url, bookmark));
    }

    document.getElementById('page').innerHTML = panel.currentPage + 1;

    document.getElementById('forward').classList.remove("disabled");
    document.getElementById('backward').classList.remove("disabled");

    if (panel.currentPage >= panel.numPages - 1) {
      document.getElementById('forward').classList.add("disabled");
    }

    if (panel.currentPage === 0) {
      document.getElementById('backward').classList.add("disabled");
    }



  }
}

let panel;


function parseUrl(url) {

  let re = /(https?:\/\/(.+?))\//;
  let m;

  let output = {};

  if ((m = re.exec(url)) !== null) {
    return m;

  }

  return ['', ''];
}

function createListElement(url, bookmark) {

  const title = bookmark.Title;
  const link = url;

  let linkTitle, siteLink;

  [, siteLink, linkTitle] = parseUrl(url);

  var listDiv = document.createElement('div');
  listDiv.className = 'list-entry';

  var linkDiv = document.createElement('div');
  linkDiv.className = 'link';

  var underLinkDiv = document.createElement('div');
  underLinkDiv.className = 'under-link';

  var arrowDiv = document.createElement('div');
  arrowDiv.className = 'arrow-up';
  arrowDiv.id = 'arrow-' + url;

  var tagsDiv = document.createElement('div');
  tagsDiv.className = 'tags';
  tagsDiv.contentEditable = true;
  tagsDiv.addEventListener('keydown', createTagEditer(url));
  tagsDiv.addEventListener('blur', createModifier(url, 'hide'), false);
  tagsDiv.id = 'tags-' + url;

  tags = '';
  for (var tag in bookmark.Tags) {
    if (tag === 'toread')
      continue;
    tags += tag + ',';
  }
  tags = tags.slice(0, -1);
  tagsDiv.innerHTML = tags;

  var siteSpan = document.createElement('span');
  var iconsSpan = document.createElement('span');
  iconsSpan.className = 'icons';

  var linkA = document.createElement('a');
  linkA.href = "#";
  linkA.innerHTML = title;
  linkA.addEventListener('click', createListener(link), false);

  var siteA = document.createElement('a');
  siteA.href = "#";
  siteA.innerHTML = linkTitle;
  siteA.addEventListener('click', createListener(siteLink), false);

  var checkI = document.createElement('i');
  checkI.className = 'fa fa-check';
  checkI.addEventListener('click', createModifier(url, 'show'), false);

  //var starI = document.createElement('i');
  //starI.className = 'fa fa-star';
  //starI.addEventListener('click', createModifier(id, 'toggle_fav', self.port), false);

  var trashI = document.createElement('i');
  trashI.className = 'fa fa-trash';
  trashI.addEventListener('click', createModifier(url, 'delete'), false);

  iconsSpan.appendChild(checkI);
  //iconsSpan.appendChild(starI);
  iconsSpan.appendChild(trashI);

  siteSpan.appendChild(siteA);

  underLinkDiv.appendChild(siteSpan);
  underLinkDiv.appendChild(iconsSpan);

  linkDiv.appendChild(linkA);

  listDiv.appendChild(linkDiv);
  listDiv.appendChild(underLinkDiv);
  listDiv.appendChild(arrowDiv);
  listDiv.appendChild(tagsDiv);

  return listDiv;


}

function drawList(entries) {
  panel.setLinks(entries);
  panel.draw();
}


function cleanList() {
  var list = document.getElementById("list");
  while (list.firstChild) {
        list.removeChild(list.firstChild);
  }
}

function refreshLinks(reset=false) {
  chrome.runtime.sendMessage(message={action: "list", reset, tags: ['toread']}, responseCallback=drawList);
}

function createListener(link) {
    return function() {
      chrome.tabs.create({url: link});
    };
}

function createModifier(url, action) {
  return function() {
      //chrome.runtime.sendMessage(message={url, action}, responseCallback=drawList);

      if (action === 'show') {
        document.getElementById('arrow-' + url).style.display = 'block';
        document.getElementById('tags-' + url).style.height = '1.3em';
        document.getElementById('tags-' + url).style.borderWidth = '2px';
        document.getElementById('tags-' + url).focus();
      } else {
        document.getElementById('arrow-' + url).style.display = 'none';
        document.getElementById('tags-' + url).style.height = '0';
        document.getElementById('tags-' + url).style.borderWidth = '0';
      }
      if (action == 'delete') {
        chrome.runtime.sendMessage(message={url, action}, responseCallback=drawList);
      }
  };
}

function searchKeyPress(e) {

  if (e.target.value.length === 0) {
    refreshLinks(reset=false);
  }
}

function simulateClick(e) {
    if (e.which === 13 && e.shiftKey === false) {
      e.preventDefault();
      e.target.click();
    }
}

function createTagEditer(url) {
  return function(e) {
      if (e.which === 13 && e.shiftKey === false) {

        let tags = [];

        e.preventDefault();
        rawTags = e.target.innerHTML;
        rawTags = rawTags.replace(/(<([^>]+)>)/ig,"");
        tags = rawTags.split(",");

        chrome.runtime.sendMessage(message={url, action: 'edit', tags}, responseCallback=drawList);
      }

  };
}

function addBookmark() {

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length === 1) {
      let url = tabs[0].url;
      let tags = document.getElementById('actionBar').value.split(',');

      document.getElementById('actionBar').value = '';
      chrome.runtime.sendMessage(message={url, tags, action: 'add'}, responseCallback=drawList);
    }
  });

}

function searchBookmark() {

  let tags = document.getElementById('actionBar').value.split(',');

  if (tags[0] === "") {
    tags = [];
  }

  chrome.runtime.sendMessage(message={tags, action: 'search'}, responseCallback=drawList);

}

function previousPage() {
  panel.previousPage();
  panel.draw();
}

function nextPage() {
  panel.nextPage();
  panel.draw();
}

function deepRefreshLinks() {
  refreshLinks(reset=true);
}

document.getElementById('backward').addEventListener('click', previousPage, false);
document.getElementById('forward').addEventListener('click', nextPage, false);
document.getElementById('add').addEventListener('click', addBookmark, false);
document.getElementById('add').addEventListener('keypress', simulateClick, false);
document.getElementById('search').addEventListener('click', searchBookmark, false);
document.getElementById('search').addEventListener('keypress', simulateClick, false);
document.getElementById('actionBar').addEventListener('keyup', searchKeyPress, false);

document.getElementById('refresh').addEventListener('click', deepRefreshLinks);


chrome.storage.local.get('options', (res) => {
  refreshLinks(reset=false);
  panel = new Panel(res.options.linkPerPage);
});

