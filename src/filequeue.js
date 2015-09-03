// Generated by CoffeeScript 1.9.2
var DEFAULT_BUFFER_SIZE, Queue, fs, markers, roundbyte, seuss;

fs = require('graceful-fs');

Queue = require('./memoryqueue');

markers = require('./markers');

roundbyte = require('./roundbyte');

DEFAULT_BUFFER_SIZE = 1024 * 128;

seuss = {
  create: function(path, buffersize) {
    var allocated, fd, fsqueue, memqueue, noopbuffer, offset;
    if (buffersize == null) {
      buffersize = DEFAULT_BUFFER_SIZE;
    }
    noopbuffer = new Buffer(buffersize);
    noopbuffer.fill(markers.noop);
    fd = fs.openSync(path, 'w');
    fs.writeSync(fd, noopbuffer, 0, buffersize, 0);
    fs.fsyncSync(fd);
    offset = 0;
    allocated = buffersize;
    memqueue = Queue();
    fsqueue = {
      enqueue: function(message) {
        var allocatesize, buffer, length, size;
        length = Buffer.byteLength(message);
        size = roundbyte(length + 8);
        allocatesize = size;
        if (offset + size > allocated) {
          allocated = Math.ceil((offset + size) / buffersize) * buffersize;
          allocatesize = allocated - offset;
        }
        buffer = new Buffer(allocatesize);
        buffer.writeUInt32BE(markers.enqueue, 0);
        buffer.writeUInt32BE(length, 4);
        buffer.write(message, 8, length);
        if (length + 8 < allocatesize) {
          buffer.fill(markers.noop, length + 8);
        }
        fs.writeSync(fd, buffer, 0, allocatesize, offset);
        fs.fsyncSync(fd);
        return offset += size;
      },
      dequeue: function() {
        var buffer;
        buffer = new Buffer(4);
        buffer.writeUInt32BE(markers.dequeue);
        if (offset + 4 > allocated) {
          buffer = Buffer.concat([buffer, noopbuffer], buffersize + 4);
          allocated += buffersize;
        }
        fs.writeSync(fd, buffer, 0, buffer.length, offset);
        fs.fsyncSync(fd);
        return offset += 4;
      },
      compact: function() {
        var i, len, message, ref;
        fd = fs.openSync(path + ".new", 'w');
        fs.writeSync(fd, noopbuffer, 0, buffersize, 0);
        fs.fsyncSync(fd);
        offset = 0;
        allocated = buffersize;
        ref = memqueue.all();
        for (i = 0, len = ref.length; i < len; i++) {
          message = ref[i];
          fsqueue.enqueue(message);
        }
        return fs.renameSync(path + ".new", path);
      },
      close: function() {
        return fs.closeSync(fd);
      }
    };
    return {
      enqueue: function(message) {
        fsqueue.enqueue(message);
        return memqueue.enqueue(message);
      },
      dequeue: function() {
        fsqueue.dequeue();
        return memqueue.dequeue();
      },
      peek: function() {
        return memqueue.peek();
      },
      length: function() {
        return memqueue.length();
      },
      all: function() {
        return memqueue.all();
      },
      compact: function() {
        fsqueue.compact();
        return memqueue.compact();
      },
      close: function() {
        return fsqueue.close();
      }
    };
  },
  open: function(path) {
    var i, len, message, messages, queue;
    queue = seuss.create(path + ".new");
    if (fs.existsSync(path)) {
      messages = seuss.read(path);
      for (i = 0, len = messages.length; i < len; i++) {
        message = messages[i];
        queue.enqueue(message);
      }
    }
    fs.renameSync(path + ".new", path);
    return queue;
  },
  print: require('./print'),
  read: require('./read')
};

module.exports = seuss;
