const express = require("express");
module.exports = {
   HostingServer: class {
      exp = express();
      wsocket = require("ws");
      http = require("http").createServer(this.exp);
      
      constructor() {
         this.exp.use(express.static("public"));
         this.exp.get("/", (_, res) => {
            res.render("index.ejs");
         });
         this.exp.get("/send", (_, res) => {
            res.render("sender.ejs");
         });
         this.exp.get("/receive", (_, res) => {
            res.render("receiver.ejs");
         });
         this.exp.get("/privacy", (_, res) => {
            res.render("privacy.ejs");
         });
         this.exp.get("/test", (_, res) => {
            res.status(200).send("[OK]");
         })
      }

      Start = (port=undefined) => {
         if (port) {
            this.http.listen(port, () => {
               console.log(`Server running on port ${port}`);
            });
         } else {
            this.http.listen(process.env.PORT, () => {
               console.log(`Server live and running`);
            });
         }
      }
   },
   TransferConnection: class {
      sender = null;
      receiver = null;
      connectionID = null;

      constructor (sender, connectionID) {
         this.sender = sender;
         this.connectionID = connectionID;
      }

      RemoveReceiver(reason=null) {
         try {
            if (reason) {
               this.receiver.send(JSON.stringify({type: "RemovedFromConnection", reason: reason}));
            } else {
               this.receiver.send(JSON.stringify({type: "RemovedFromConnection"}));
            }
         } catch {}
         this.receiver = null;
      }
   },
   RandomID: (length=3) => {
      var ID = '';
      var characters = 'abcdefghijkmnpqrstuvwxyz123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      for (let i = 0; i < length; i++) {
         ID += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return ID;
   }
}