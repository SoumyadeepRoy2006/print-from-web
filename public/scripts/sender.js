var connected = false;
var receiverConnected = false;
const server = new WebSocket(`ws://${location.host}/`);
server.binaryType = "arraybuffer";
const binaryReadSize = 128 * 1024;
var sending = false;


window.onload = () => {
   const fileWindow = document.getElementById("fileSend");
   const filePDF = document.querySelector("input#pdf");
   const outputWindow = document.getElementById("output").querySelector("div");

   function Log(str) {
      const log = document.createElement("p");
      log.textContent = str;
      outputWindow.appendChild(log);
   }

   function showFileWindow(show) {
      if (show) {
         fileWindow.removeAttribute("hidden");
      } else {
         fileWindow.setAttribute("hidden", true);
      }
   }

   document.querySelectorAll('button').forEach(button => {
      button.addEventListener("click", () => {
         switch (button.getAttribute("id")) {
            case "btn_sender":
               server.send(JSON.stringify({request: "NewConnection"}));
               break;

            case "btn_sendFile":
               const file = filePDF.files[0];
                  if (file) {
                     if (sending) {
                        Log("Already sending a file");
                     } else {
                        server.send(JSON.stringify({request: "FileTransferRequest", type: "pdf"}));
                        Log("Waiting for receiver to respond...");
                     }
                  } else {
                     Log("Attach file before sending");
                  }
               break;

            default:
               break;
         }
      })
   });

   server.onopen = () => {
      Log("Connected to hosting server");
   }

   server.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
         case "NewConnection":
            connected = true;
            Log(message.message);
            break;

         case "ReceiverConnected":
            receiverConnected = true;
            showFileWindow(true);
            Log("Receiver connected");
            break;

         case "ReceiverDisconnected":
            receiverConnected = false;
            if (sending) {
               sending = false;
               Log("Receiver disconnected, transfer did not complete");
            } else {
               Log("Receiver disconnected");
            }
            showFileWindow(false);
            break;

         case "Message":
            Log(message.message);
            break;

         case "StartTransfer":
            sending = true;
            Log("Transfer started...");
            const file = fileWindow.querySelector("input").files[0];
            if (file) {
               for (let startByte = 0; startByte < file.size; startByte += binaryReadSize) {
                  if (receiverConnected) {
                     const buffer = await file.slice(startByte, startByte + binaryReadSize).arrayBuffer();
                     server.send(buffer, {binary: true});
                  } else {
                     sending = false;
                     break;
                  }
               }
               if (receiverConnected && sending) {
                  sending = false;
                  server.send(JSON.stringify({request: "DoneSend"}));
               }
               Log("Transfer complete");
            } else {
               Log("Can't get the selected file");
            }
            break;

         default:
            break;
      }
   }
   server.onclose = () => {
      showFileWindow(false);
      if (sending) {
         Log("Disconnected from hosting server, transfer did not complete. Reload to reconnect");
         sending = false;
      } else {
         Log("Disconnected from hosting server, reload to reconnect");
      }
      receiverConnected = false;
      connected = false;
   }
};
