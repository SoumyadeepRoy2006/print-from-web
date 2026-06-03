const { HostingServer, TransferConnection } = require("./modules.js");
const { RandomID } = require("./modules.js");
const server = new HostingServer();

const WSServer = new server.wsocket.Server({ server:server.http, path:"/" });
const TransferConnectionGroup = [];

WSServer.on("connection", (client) => {
   console.log("Client connected");
   var transferConnection;
   var clientType = undefined;

   client.on("message", (incomingData, binary) => {
      if (!binary) {
         incomingData = JSON.parse(incomingData);
         switch (incomingData.request) {
            case "NewConnection":
               clientType = "sender";
               if (transferConnection) {
                  if (transferConnection.receiver) {
                     try {
                        transferConnection.RemoveReceiver(reason="SenderDisconnected");
                     } catch {}
                  }
                  TransferConnectionGroup.splice(TransferConnectionGroup.indexOf(transferConnection), 1);
                  transferConnection = null;
               }
               transferConnection = new TransferConnection(client, RandomID());
               TransferConnectionGroup.push(transferConnection);
               client.send(JSON.stringify({type: "NewConnection", message: `New connection created. Connection ID: ${transferConnection.connectionID}`}));
               break;

            case "FileTransferRequest":
               if (transferConnection) {
                  if (transferConnection.receiver) {
                     try {
                        transferConnection.receiver.send(JSON.stringify({type: "SenderRequest", fileType: incomingData.type}));
                     } catch {}
                  } else {
                     try {
                        client.send(JSON.stringify({type: "Message", message: "No receiver. Wait for your receiver to connect"}));
                     } catch {}
                  }
               } else {
                  try {
                     client.send(JSON.stringify({type: "Message", message: "Connect to a transfer connection first"}));
                  } catch {}
               }
               break;

            case "DoneSend":
               if (transferConnection) {
                  if (transferConnection.receiver) {
                     try {
                        transferConnection.receiver.send(JSON.stringify({type: "DoneSend"}));
                     } catch {}
                  } else {
                     try {
                        client.send(JSON.stringify({type: "Message", message: "Connection lost with receiver"}));
                     } catch {}
                  }
               } else {
                  try {
                     client.send(JSON.stringify({type: "Message", message: "Failed to finish the transfer process"}));
                  } catch {}
               }
               break;

            case "JoinConnection":
               transferConnection = TransferConnectionGroup.find(x => x.connectionID == incomingData.connectionID);
               if (transferConnection){
                  if (transferConnection.receiver) {
                     try {
                        if (transferConnection.receiver == client) {
                           client.send(JSON.stringify({type: "Message", message: "Already connected to this sender"}));
                        } else {
                           client.send(JSON.stringify({type: "Message", message: "This connection already has a receiver, ask the sender to create another connection for transfer"}));
                        }
                     } catch {}
                  } else {
                     transferConnection.receiver = client;
                     clientType = "receiver";
                     try {
                        client.send(JSON.stringify({type: "JoinedConnection"}));
                     } catch {}
                     try {
                        transferConnection.sender.send(JSON.stringify({type: "ReceiverConnected"}));
                     } catch {}
                  }
               } else {
                  client.send(JSON.stringify({type: "NoConnection"}));
               }
               break;

            case "StartTransfer":
               if (transferConnection) {
                  try {
                     transferConnection.sender.send(JSON.stringify({type: "StartTransfer"}));
                  } catch {}
               }
               break;

            default:
               break;
         }
      } else {
         try {
            if (transferConnection.receiver) {
               transferConnection.receiver.send(incomingData);
            } else {
               client.send(JSON.stringify({type: "ReceiverDisconnected"}));
            }
         } catch {}
      }
   });

   client.on("close", () => {
      switch (clientType) {
         case "sender":
            if (transferConnection) {
               if (transferConnection.receiver) {
                  try {
                     transferConnection.RemoveReceiver(reason="SenderDisconnected");
                  } catch {}
               }
               TransferConnectionGroup.splice(TransferConnectionGroup.indexOf(transferConnection), 1);
               transferConnection = null;
            }
            break;

         case "receiver":
            try {
               transferConnection.sender.send(JSON.stringify({type: "ReceiverDisconnected"}))
            } catch {}
            try {
               transferConnection.receiver = null;
            } catch {}
            break;

         default:
            break;
      }
      console.log("Client disconnected");
   });
});
server.Start(2000);
