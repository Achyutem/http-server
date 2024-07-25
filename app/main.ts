import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';

enum Status {
  OK = '200 OK',
  CREATED = '201 Created',
  NOT_FOUND = '404 Not Found',
  CRLF = '\r\n'
}

const directory = process.argv.includes('--directory') ? process.argv[process.argv.indexOf('--directory') + 1] : '';

const server = net.createServer((socket) => {
  socket.on('data', async (data) => {
    const message = data.toString();
    const [requestLine, ...headers] = message.split('\r\n');
    const [method, fullPath] = requestLine.split(' ');

    if (method === 'GET') {
      if (fullPath === '/') {
        socket.write(`HTTP/1.1 ${Status.OK}${Status.CRLF}${Status.CRLF}`);
      } else if (fullPath.startsWith('/echo/')) {
        const acceptEncodingHeader = headers.find(header => header.toLowerCase().startsWith('accept-encoding:'));
        const encodings = acceptEncodingHeader ? acceptEncodingHeader.split(':')[1].split(',').map(encoding => encoding.trim()) : [];
        const str = fullPath.slice(6);

        if (encodings.includes('gzip')) {
          const gzipContent = gzipSync(str);
          const encodingHeader = [
            `HTTP/1.1 ${Status.OK}`,
            `Content-Type: text/plain`,
            `Content-Encoding: gzip`,
            `Content-Length: ${gzipContent.length}`,
            `${Status.CRLF}`
          ].join(Status.CRLF);
          socket.write(encodingHeader);
          socket.write(gzipContent);
        } else {
          const responseHeader = [
            `HTTP/1.1 ${Status.OK}`,
            `Content-Type: text/plain`,
            `Content-Length: ${str.length}`,
            `${Status.CRLF}`
          ].join(Status.CRLF);
          socket.write(responseHeader + str);
        }
      } else if (fullPath.startsWith('/user-agent')) {
        const userAgent = message.split('\r\n').find(line => line.startsWith('User-Agent:'))?.split(': ')[1] || '';
        const responseHeader = [
          `HTTP/1.1 ${Status.OK}`,
          `Content-Type: text/plain`,
          `Content-Length: ${userAgent.length}`,
          `${Status.CRLF}`
        ].join(Status.CRLF);
        socket.write(responseHeader + userAgent);
      } else if (fullPath.startsWith('/files/')) {
        const requestedFile = fullPath.slice(7);
        const filePath = path.join(directory, requestedFile);
        
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath);
          const responseHeader = [
            `HTTP/1.1 ${Status.OK}`,
            `Content-Type: application/octet-stream`,
            `Content-Length: ${fileContent.length}`,
            `${Status.CRLF}`
          ].join(Status.CRLF);
          socket.write(responseHeader);
          socket.write(fileContent);
        } else {
          socket.write(`HTTP/1.1 ${Status.NOT_FOUND}${Status.CRLF}${Status.CRLF}`);
        }
      } else {
        socket.write(`HTTP/1.1 ${Status.NOT_FOUND}${Status.CRLF}${Status.CRLF}`);
      }
      socket.end();
    } else if (method === 'POST' && fullPath.startsWith('/files/')) {
      const requestedFile = fullPath.slice(7);
      const filePath = path.join(directory, requestedFile);
      const fileContent = message.split(Status.CRLF + Status.CRLF)[1]; 

      fs.writeFileSync(filePath, fileContent);
      socket.write(`HTTP/1.1 ${Status.CREATED}${Status.CRLF}${Status.CRLF}`);
      socket.end();
    } else {
      socket.write(`HTTP/1.1 ${Status.NOT_FOUND}${Status.CRLF}${Status.CRLF}`);
      socket.end();
    }
  });
});

server.listen(4221, 'localhost', () => {
  console.log('Server is running at 4221');
});
