import { defineConfig } from 'vite';
import { Server } from 'socket.io';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0', // Permite que otros dispositivos en el mismo WiFi se conecten
    port: 3000,
    open: false,
  },
  plugins: [
    {
      name: 'socket-io-plugin',
      configureServer(server) {
        // Configuramos Socket.IO para que se una al servidor nativo de Vite
        const io = new Server(server.httpServer, {
          cors: {
            origin: '*',
          }
        });

        io.on('connection', (socket) => {
          console.log('🔗 Empleado conectado al Server KDS:', socket.id);
          
          socket.on('sync-kds', (data) => {
            // Cuando un dispositivo manda el evento, retransmitirlo (broadcast)
            // a TODOS los demás dispositivos instantáneamente para que actualicen sus KDS
            socket.broadcast.emit('sync-kds', data);
          });
          
          socket.on('disconnect', () => {
            console.log('❌ Empleado desconectado:', socket.id);
          });
        });
      }
    }
  ]
});
