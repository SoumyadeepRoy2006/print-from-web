const { HostingServer, TransferConnection } = require("./modules.js");
const { RandomID } = require("./modules.js");
const server = new HostingServer();

const WSServer = new server.wsocket.Server({ server:server.http, path:"/" });
const TransferConnectionGroup = [];

WSServer.on("connection", (client) => {
   var transferConnection;
   var clientType = undefined;
   var transferInProgress = false;

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
               transferInProgress = false;
               if (transferConnection.receiver) {
                  try {
                     transferConnection.receiver.send(JSON.stringify({type: "DoneSend"}));
                     console.log("A transfer was successful");
                  } catch {}
               } else {
                  try {
                     client.send(JSON.stringify({type: "Message", message: "Connection lost with receiver"}));
                     console.log("Failed to finish the transfer process due to receiver disconnecting at the last moment");
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
               if (!transferInProgress) {
                  transferInProgress = true;
                  console.log("A transfer is in progress...");
               }
               transferConnection.receiver.send(incomingData);
            } else {
               transferInProgress = false;
               client.send(JSON.stringify({type: "ReceiverDisconnected"}));
               console.log("A transfer was failed due to receiver disconnection");
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
                  if (transferInProgress) {
                     transferInProgress = false;
                     console.log("A transfer was failed due to sender disconnection");
                  }
               }
               TransferConnectionGroup.splice(TransferConnectionGroup.indexOf(transferConnection), 1);
               transferConnection = null;
            }
            break;

         case "receiver":
            try {
               transferConnection.sender.send(JSON.stringify({type: "ReceiverDisconnected"}));
            } catch {}
            transferConnection.receiver = null;
            if (transferInProgress) {
               transferInProgress = false;
               console.log("A transfer was failed due to receiver disconnection");
            }
            break;

         default:
            break;
      }
   });
});
server.Start();
