require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");

// Configurar Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messagesRef = db.collection("messages");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());

io.on("connection", async (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Unir al chat global
  const room = "global_chat";
  socket.join(room);

  // Enviar mensajes antiguos al usuario conectado
  const snapshot = await messagesRef.orderBy("timestamp", "asc").get();
  const messages = snapshot.docs.map(doc => doc.data());
  socket.emit("loadMessages", messages);

  // Manejar mensajes entrantes
  socket.on("sendMessage", async (data) => {
    const { remitente, texto } = data;
    const hora = new Date().toLocaleTimeString();

    const newMessage = {
      remitente,
      texto,
      hora,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Guardar en Firestore
    await messagesRef.add(newMessage);

    // Enviar mensaje a todos los conectados
    io.to(room).emit("newMessage", newMessage);
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
