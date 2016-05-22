/*jshint esnext: true */

// Pure Object Class
class PureMsg {

  constructor() {
    this.Action = "";
    this.DataType = "";
    this.LogList = [];
    this.RequestMap = new Map();
    this.ResponseMap = new Map();
    this.TransactionMap = new Map();
  }

  // Serialize to JSON
  // The only problem is the serialization of the Maps
  serialize() {

    let tmp = {};
    Object.assign(tmp, this);

    const maps = ['RequestMap', 'ResponseMap', 'TransactionMap'];

    for (let map of maps) {
      tmp[map] = Object.create(null);
      for (let [k, v] of this[map]) {
        tmp[map][k] = v;
      }
    }

    return JSON.stringify(tmp);

  }

}

// Pure Websocket Link
// Used to wrap request inside a promise object
class PureConn {
  
  openWebsocket() {
    this.connecting = true;
    this.sock = new WebSocket(this.url);

    this.sock.onclose = () => {
      this.clientId = "";
      this.errorCb({
        type: "ConnectionLost",
        message: "Connection to the server lost"
      });
      this.connecting = false;
    };

    this.sock.onerror = (error) => {
      console.log(error);
      this.errorCb({
        type: "WebsocketError",
        message: "Error in communicating with the server"
      });

    };

    // Wait for response message to set clientId and create real receiver
    
    this.sock.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      this.clientId = msg.ClientId;
      this.connecting = false;

      console.log("Client got ID: ", this.clientId);

      this.sock.onmessage = (event) => {
        let msg = JSON.parse(event.data);

        // We initiated the request so there is a promise waiting
        if (parseInt(msg.TransactionMap.client, 10) === this.clientId) {

          var resolve = this.promisesResolve.get(parseInt(msg.TransactionMap.id, 10));
          var reject = this.promisesReject.get(parseInt(msg.TransactionMap.id, 10));

          for (let log of msg.LogList || []) {
            if (log.Level === 0) {
              reject(msg);
            }
          }
          resolve(msg);
        }

        const id = msg.ResponseMap.id;

        // Check if there is a callback
        if (this.changeCallback.has(id)) {
          this.changeCallback.get(id)(msg);
        }
      };

      for (let r of this.requestQueue) {
        // If new connection the client ID changed
        r.TransactionMap.set("client", "" + this.clientId);
        this.sock.send(r.serialize());
        this.requestQueue.delete(r);
      }


    };


  }

  constructor(url, username=false, password=false, errorCb=null) {
    this.url = url;
    this.promisesResolve = new Map();
    this.promisesReject = new Map();
    this.changeCallback = new Map();
    this.idNumber = 0;
    this.clientId = "";
    this.connecting = false;

    this.username = username;
    this.password = password;
    this.errorCb = errorCb || function() {};

    this.requestQueue = new Set(); 

    this.openWebsocket();
  }

  get id () {
    this.idNumber += 1;
    return this.idNumber;

  }

  request(req) {

    var reqId = this.id;

    const promise = new Promise((resolve, reject) => {
      this.promisesResolve.set(reqId, resolve);
      this.promisesReject.set(reqId, reject);
    });

    const tMap = new Map();
    tMap.set("id", "" + reqId);
    tMap.set("client", "" + this.clientId);

    if (this.username) {
      tMap.set("username", this.username);
      tMap.set("password", this.password);
    }

    req.TransactionMap = tMap;

    if (this.clientId === "") {
      this.requestQueue.add(req);
      if (this.connecting === false) {
        this.openWebsocket();
      }
      return promise;
    }

    // Create the handler
    this.sock.send(req.serialize());
    console.log(req.serialize());

    return promise;
  }
}

class Gomark {

  constructor(url, username=false, password=false) {
    this.connection = new PureConn(url, username, password, this.error);
  }

  error(obj) {
    chrome.notifications.create({
      type: "basic",
      title: "Gomarks Error",
      message: obj.message
    });
  }

  get(url) {

    let msg = new PureMsg();
    msg.Action = "retrieve";
    msg.DataType = "bookmark";

    const reqMap = new Map();
    reqMap.set("url", url);

    msg.RequestMap = reqMap;

    return this.connection.request(msg).then((r) => {
      return r.ResponseMap.result;
    });
  }

  add(url, tags) {

    let msg = new PureMsg();
    msg.Action = "create";
    msg.DataType = "bookmark";

    let bookmark = {
      url,
      tags
    };

    bookmark.tags = tags;
    
    const reqMap = new Map();
    reqMap.set("data", bookmark);
    
    msg.RequestMap = reqMap;

    return this.connection.request(msg).then( (result) => {
      return result.ResponseMap.result;
    }, (r) => {
      for (let log of r.LogList || []) {
        if (log.Level === 0) {
          this.error({
            type: "RequestError",
            message: log.Message
          });
        }
      }
    });
  }
  
  edit(url, tags, add_tags, del_tags) {

    let msg = new PureMsg();
    msg.Action = "update";
    msg.DataType = "bookmark";

    let bookmark = {
      url,
      tags
    };
    
    const reqMap = new Map();
    reqMap.set("url", url);
    reqMap.set("data", bookmark);
    reqMap.set("add_tags", add_tags);
    reqMap.set("del_tags", del_tags);
    
    msg.RequestMap = reqMap;

    return this.connection.request(msg).then( (result) => {
      return result.ResponseMap.result;
    }, (r) => {
      for (let log of r.LogList || []) {
        if (log.Level === 0) {
          this.error({
            type: "RequestError",
            message: log.Message
          });
        }
      }
    });
  }
  
  del(url) {

    let msg = new PureMsg();
    msg.Action = "delete";
    msg.DataType = "bookmark";

    const reqMap = new Map();
    reqMap.set("url", url);

    msg.RequestMap = reqMap;

    return this.connection.request(msg).then((r) => {
      for (let log of r.LogList || []) {
        if (log.Level == 2) {
          return (log.Message);
        }
      }
      return "Success";
    }, (r) => {
      for (let log of r.LogList || []) {
        if (log.Level === 0) {
          this.error({
            type: "RequestError",
            message: log.Message
          });
        }
      }
    });

  }


}

