var connected = false;
var receiving = false;
const server = new WebSocket(`ws://${location.host}`);
var fileParts = [];
server.binaryType = "arraybuffer";


window.onload = () => {
   const IDInput = document.querySelector(`input[name="connectionID"]`);
   const outputWindow = document.getElementById("output").querySelector("div");
   
   function Log(str) {
      const log = document.createElement("p");
      log.textContent = str;
      outputWindow.appendChild(log);
   }
   
   document.querySelector('button#btn_receiver').addEventListener("click", () => {
      const connectionID = IDInput.value.trim();
      if (connectionID != '') server.send(JSON.stringify({request: "JoinConnection", connectionID: connectionID}));
   });

   server.onopen = () => {
      Log("Connected to hosting server");
   }

   server.onmessage = (event) => {
      if (typeof(event.data) === "string") {
         const message = JSON.parse(event.data);
         switch (message.type) {
            case "JoinedConnection":
               connected = true;
               Log("Successfully connected");
               break;

            case "NoConnection":
               Log("No connection found with this ID. Check sender's connection ID and try again");
               break;
            
            case "RemovedFromConnection":
               connected = false;
               switch (message.reason) {
                  case "SenderDisconnected":
                     if (receiving) {
                        Log("Sender disconnected, transfer did not complete, join a new connection");
                        receiving = false;
                     } else {
                        Log("Sender disconnected, current connection terminated, join a new connection");
                     }
                     break;
                     
                  default:
                     Log("Your connection was terminated, please reconnect or join a new connection");
                     break;
               }
               break;

            case "Message":
               Log(message.message);
               break;

            case "SenderRequest":
               fileParts = [];
               receiving = true;
               server.send(JSON.stringify({request: "StartTransfer"}));
               Log("Receiving file...")
               break;

            case "DoneSend":
               receiving = false;
               Log("File received")
               const blob = new Blob(fileParts, {type: "application/pdf"});
               const url = URL.createObjectURL(blob);
               const width = Math.floor(screen.width*8/10); const height = Math.floor(screen.height*8/10);
               const left = Math.floor((screen.width - width)/4); const top = Math.floor((screen.height - height)/4); 
               Log("Opening print page...");
               try {
                  const newTab = window.open(
                     url,
                     "_blank",
                     `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                  );
                  newTab.onload = () => {
                     newTab.focus();
                     newTab.print();
                  };
               } catch {
                  Log("Could not open print page. Check for blocked pop-ups")
               }
               break;

            default:
               break;
         }
      } else if (receiving) {
         fileParts.push(event.data);
      }
   }
   server.onclose = () => {
      if (receiving) {
         Log("Disconnected from hosting server, transfer did not complete. Reload to reconnect");
         receiving = false;
      } else {
         Log("Disconnected from hosting server, reload to reconnect");
      }
      connected = false;
   }
};
