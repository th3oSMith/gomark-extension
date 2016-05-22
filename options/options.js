/*jshint esnext: true */
document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);


function restoreOptions () {
  chrome.storage.local.get('options', (res) => {

    const options = res.options;
    
    document.querySelector("#serverUrl").value = options.url || '';
    document.querySelector("#serverUsername").value = options.username || '';
    document.querySelector("#serverPassword").value = options.password || '';
  });
}

function saveOptions () {

  let url = document.querySelector("#serverUrl").value; 
  let username = document.querySelector("#serverUsername").value; 
  let password = document.querySelector("#serverPassword").value; 

  options = {
    url,
    username,
    password
  };

  chrome.storage.local.set({options});
  console.log("send messahe");
  chrome.runtime.sendMessage(message={action: "init", options});
}
