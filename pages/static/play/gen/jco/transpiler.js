// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/io.js
var id = 0;
var symbolDispose = Symbol.dispose || Symbol.for("dispose");
var IoError = class extends Error {
  toDebugString() {
    return this.message;
  }
};
var InputStream = class _InputStream {
  id;
  handler;
  static _create(handler) {
    const stream = new _InputStream();
    if (!handler) {
      console.trace("no handler");
    }
    stream.id = ++id;
    stream.handler = handler;
    return stream;
  }
  read(len) {
    if (this.handler.read) {
      return this.handler.read(len);
    }
    return this.handler.blockingRead.call(this, len);
  }
  blockingRead(len) {
    return this.handler.blockingRead.call(this, len);
  }
  skip(len) {
    if (this.handler.skip) {
      return this.handler.skip.call(this, len);
    }
    if (this.handler.read) {
      const bytes = this.handler.read.call(this, len);
      return BigInt(bytes.byteLength);
    }
    return this.blockingSkip.call(this, len);
  }
  blockingSkip(len) {
    if (this.handler.blockingSkip) {
      return this.handler.blockingSkip.call(this, len);
    }
    const bytes = this.handler.blockingRead.call(this, len);
    return BigInt(bytes.byteLength);
  }
  subscribe() {
    if (this.handler.subscribe) {
      return this.handler.subscribe();
    }
    return new Pollable();
  }
  [symbolDispose]() {
    if (this.handler.drop) {
      this.handler.drop.call(this);
    }
  }
};
var inputStreamCreate = InputStream._create;
delete InputStream._create;
var OutputStream = class _OutputStream {
  id;
  open;
  handler;
  static _create(handler) {
    const stream = new _OutputStream();
    if (!handler) {
      console.trace("no handler");
    }
    stream.id = ++id;
    stream.open = true;
    stream.handler = handler;
    return stream;
  }
  checkWrite() {
    if (!this.open) {
      return 0n;
    }
    if (this.handler.checkWrite) {
      return this.handler.checkWrite.call(this);
    }
    return 1000000n;
  }
  write(buf) {
    this.handler.write.call(this, buf);
  }
  blockingWriteAndFlush(buf) {
    if (this.handler.blockingWriteAndFlush) {
      return this.handler.blockingWriteAndFlush.call(this, buf);
    }
    this.handler.write.call(this, buf);
  }
  flush() {
    if (this.handler.flush) {
      this.handler.flush.call(this);
    }
  }
  blockingFlush() {
    this.open = true;
    if (this.handler.blockingFlush) {
      this.handler.blockingFlush.call(this);
    }
  }
  writeZeroes(len) {
    this.write.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroesAndFlush(len) {
    this.blockingWriteAndFlush.call(this, new Uint8Array(Number(len)));
  }
  splice(src, len) {
    const spliceLen = Math.min(Number(len), Number(this.checkWrite.call(this)));
    const bytes = src.read(BigInt(spliceLen));
    this.write.call(this, bytes);
    return BigInt(bytes.byteLength);
  }
  blockingSplice(_src, _len) {
    console.log(`[streams] Blocking splice ${this.id}`);
    return 0n;
  }
  subscribe() {
    if (this.handler.subscribe) {
      return this.handler.subscribe();
    }
    return new Pollable();
  }
  [symbolDispose]() {
  }
};
var outputStreamCreate = OutputStream._create;
delete OutputStream._create;
var error = {
  Error: IoError
};
var streams = { InputStream, OutputStream };
var Pollable = class _Pollable {
  #ready = false;
  #promise = null;
  static _create(promise) {
    const pollable = new _Pollable();
    if (!promise) {
      pollable.#ready = true;
    } else {
      pollable.#promise = promise.then(() => {
        pollable.#ready = true;
      }, () => {
        pollable.#ready = true;
      });
    }
    return pollable;
  }
  ready() {
    return this.#ready;
  }
  block() {
    if (this.#ready) {
      return Promise.resolve();
    }
    return this.#promise || Promise.resolve();
  }
  [symbolDispose]() {
    this.#promise = null;
  }
};
var pollableCreate = Pollable._create;
delete Pollable._create;

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/config.js
var _cwd = "/";
function _getCwd() {
  return _cwd;
}

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/environment.js
var _env = [];
var _args = [];
var _cwd2 = "/";
var environment = {
  getEnvironment() {
    return _env;
  },
  getArguments() {
    return _args;
  },
  initialCwd() {
    return _cwd2;
  }
};

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/cli.js
var symbolDispose2 = Symbol.dispose ?? Symbol.for("dispose");
var ComponentExit = class extends Error {
  exitError = true;
  code;
  constructor(code) {
    super(`Component exited ${code === 0 ? "successfully" : "with error"}`);
    this.code = code;
  }
};
var exit = {
  exit(status) {
    throw new ComponentExit(status.tag === "err" ? 1 : 0);
  },
  // @ts-expect-error - Available only wasi-cli v0.2.12
  exitWithCode(code) {
    throw new ComponentExit(code);
  }
};
var stdinStream = inputStreamCreate({
  blockingRead(_len) {
    return new Uint8Array(0);
  },
  subscribe() {
    return pollableCreate();
  },
  [symbolDispose2]() {
  }
});
var textDecoder = new TextDecoder();
var stdoutStream = outputStreamCreate({
  write(contents) {
    if (contents.at(-1) == 10) {
      contents = contents.subarray(0, -1);
    }
    console.log(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose2]() {
  }
});
var stderrStream = outputStreamCreate({
  write(contents) {
    if (contents.at(-1) == 10) {
      contents = contents.subarray(0, -1);
    }
    console.error(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose2]() {
  }
});
var stdin = {
  getStdin() {
    return stdinStream;
  }
};
var stdout = {
  getStdout() {
    return stdoutStream;
  }
};
var stderr = {
  getStderr() {
    return stderrStream;
  }
};
var TerminalInput = class {
};
var TerminalOutput = class {
};
var terminalStdoutInstance = new TerminalOutput();
var terminalStderrInstance = new TerminalOutput();
var terminalStdinInstance = new TerminalInput();
var terminalInput = {
  TerminalInput
};
var terminalOutput = {
  TerminalOutput
};
var terminalStderr = {
  getTerminalStderr() {
    return terminalStderrInstance;
  }
};
var terminalStdin = {
  getTerminalStdin() {
    return terminalStdinInstance;
  }
};
var terminalStdout = {
  getTerminalStdout() {
    return terminalStdoutInstance;
  }
};

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/filesystem.js
var _fileData = { dir: {} };
var timeZero = {
  seconds: 0n,
  nanoseconds: 0
};
function coerceToSafeIntegerNumber(obj) {
  let n;
  if (typeof obj === "number") {
    n = obj;
  } else if (typeof obj == "bigint") {
    n = Number(obj);
  } else {
    throw new TypeError(`unexpected non-numeric type: ${obj}`);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new TypeError(`excessively large number: ${n}`);
  }
  return n;
}
function getChildEntry(parentEntry, subpath, openFlags) {
  if (subpath === "." && _rootPreopen && descriptorGetEntry(_rootPreopen[0]) === parentEntry) {
    subpath = _getCwd();
    if (subpath.startsWith("/") && subpath !== "/") {
      subpath = subpath.slice(1);
    }
  }
  let entry = parentEntry;
  let segmentIdx;
  do {
    if (!entry?.dir) {
      throw "not-directory";
    }
    segmentIdx = subpath.indexOf("/");
    const segment = segmentIdx === -1 ? subpath : subpath.slice(0, segmentIdx);
    if (segment === "..") {
      throw "no-entry";
    }
    if (segment === "." || segment === "") {
    } else if (!entry.dir[segment] && openFlags.create) {
      entry = entry.dir[segment] = openFlags.directory ? { dir: {} } : { source: new Uint8Array([]) };
    } else {
      entry = entry.dir[segment];
    }
    subpath = subpath.slice(segmentIdx + 1);
  } while (segmentIdx !== -1);
  if (!entry) {
    throw "no-entry";
  }
  return entry;
}
function getSource(fileEntry) {
  if (typeof fileEntry.source === "string") {
    fileEntry.source = new TextEncoder().encode(fileEntry.source);
  }
  return fileEntry.source;
}
var DirectoryEntryStream = class _DirectoryEntryStream {
  idx = 0;
  entries = [];
  static _create(entries) {
    const stream = new _DirectoryEntryStream();
    stream.entries = entries;
    return stream;
  }
  readDirectoryEntry() {
    if (this.idx === this.entries.length) {
      return void 0;
    }
    const [name, entry] = this.entries[this.idx];
    this.idx += 1;
    return {
      name,
      type: entry.dir ? "directory" : "regular-file"
    };
  }
};
var descriptorEntryStreamCreate = DirectoryEntryStream._create;
delete DirectoryEntryStream._create;
var Descriptor = class _Descriptor {
  #stream;
  #entry;
  #mtime = 0;
  _getEntry(descriptor) {
    return descriptor.#entry;
  }
  static _create(entry, isStream) {
    const descriptor = new _Descriptor();
    if (isStream) {
      descriptor.#stream = entry;
    } else {
      descriptor.#entry = entry;
    }
    return descriptor;
  }
  readViaStream(_offset) {
    const source = getSource(this.#entry);
    let offset = Number(_offset);
    return inputStreamCreate({
      blockingRead(len) {
        if (offset === source.byteLength) {
          throw { tag: "closed" };
        }
        const bytes = source.slice(offset, offset + Number(len));
        offset += bytes.byteLength;
        return bytes;
      }
    });
  }
  writeViaStream(_offset) {
    const entry = this.#entry;
    let offset = Number(_offset);
    return outputStreamCreate({
      write(buf) {
        const src = entry.source;
        const newSource = new Uint8Array(buf.byteLength + src.byteLength);
        newSource.set(src, 0);
        newSource.set(buf, offset);
        offset += buf.byteLength;
        entry.source = newSource;
      }
    });
  }
  appendViaStream() {
    console.log(`[filesystem] APPEND STREAM`);
    return {};
  }
  advise(offset, length, advice) {
    console.log(`[filesystem] ADVISE`, offset, length, advice);
  }
  syncData() {
    console.log(`[filesystem] SYNC DATA`);
  }
  getFlags() {
    console.log(`[filesystem] FLAGS FOR`);
    return {};
  }
  getType() {
    if (this.#stream) {
      return "fifo";
    }
    if (this.#entry.dir) {
      return "directory";
    }
    if (this.#entry.source) {
      return "regular-file";
    }
    return "unknown";
  }
  setSize(size) {
    console.log(`[filesystem] SET SIZE`, size);
  }
  setTimes(dataAccessTimestamp, dataModificationTimestamp) {
    console.log(`[filesystem] SET TIMES`, dataAccessTimestamp, dataModificationTimestamp);
  }
  read(length, offset) {
    const source = getSource(this.#entry);
    const off = coerceToSafeIntegerNumber(offset);
    const len = coerceToSafeIntegerNumber(length);
    const result = [
      source.slice(off, off + len),
      off + len >= source.byteLength
    ];
    return result;
  }
  write(buffer, offset) {
    if (offset !== 0n) {
      throw "invalid-seek";
    }
    this.#entry.source = buffer;
    return BigInt(buffer.byteLength);
  }
  readDirectory() {
    if (!this.#entry?.dir) {
      throw "bad-descriptor";
    }
    return descriptorEntryStreamCreate(Object.entries(this.#entry.dir).sort(([a], [b]) => a > b ? 1 : -1));
  }
  sync() {
    console.log(`[filesystem] SYNC`);
  }
  createDirectoryAt(path) {
    const entry = getChildEntry(this.#entry, path, {
      create: true,
      directory: true
    });
    if (entry.source) {
      throw "exist";
    }
  }
  stat() {
    let type = "unknown";
    let size = 0n;
    if (this.#entry.source) {
      type = "regular-file";
      const source = getSource(this.#entry);
      size = BigInt(source.byteLength);
    } else if (this.#entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: 0n,
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  statAt(_pathFlags, path) {
    const entry = getChildEntry(this.#entry, path, {
      create: false,
      directory: false
    });
    let type = "unknown";
    let size = 0n;
    if (entry.source) {
      type = "regular-file";
      const source = getSource(entry);
      size = BigInt(source.byteLength);
    } else if (entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: 0n,
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  setTimesAt() {
    console.log(`[filesystem] SET TIMES AT`);
  }
  linkAt() {
    console.log(`[filesystem] LINK AT`);
  }
  openAt(_pathFlags, path, openFlags, _flags) {
    const childEntry = getChildEntry(this.#entry, path, openFlags);
    return descriptorCreate(childEntry);
  }
  readlinkAt(_path) {
    console.log(`[filesystem] READLINK AT`);
    return "";
  }
  removeDirectoryAt() {
    console.log(`[filesystem] REMOVE DIR AT`);
  }
  renameAt() {
    console.log(`[filesystem] RENAME AT`);
  }
  symlinkAt() {
    console.log(`[filesystem] SYMLINK AT`);
  }
  unlinkFileAt() {
    console.log(`[filesystem] UNLINK FILE AT`);
  }
  isSameObject(other) {
    return other === this;
  }
  metadataHash() {
    let upper = 0n;
    upper += BigInt(this.#mtime);
    return { upper, lower: 0n };
  }
  metadataHashAt(_pathFlags, _path) {
    return this.metadataHash();
  }
};
var descriptorGetEntry = Descriptor.prototype._getEntry;
delete Descriptor.prototype._getEntry;
var descriptorCreate = Descriptor._create;
delete Descriptor._create;
var _preopens = [[descriptorCreate(_fileData), "/"]];
var _rootPreopen = _preopens[0];
var preopens = {
  getDirectories() {
    return _preopens;
  }
};
var types = {
  Descriptor,
  DirectoryEntryStream,
  filesystemErrorCode: (err) => {
    let message;
    if ("payload" in err) {
      message = err.payload;
    } else if ("message" in err) {
      message = err.message;
    }
    return convertFsError(message);
  }
};
function convertFsError(e) {
  switch (e.code) {
    case "EACCES":
      return "access";
    case "EAGAIN":
    case "EWOULDBLOCK":
      return "would-block";
    case "EALREADY":
      return "already";
    case "EBADF":
      return "bad-descriptor";
    case "EBUSY":
      return "busy";
    case "EDEADLK":
      return "deadlock";
    case "EDQUOT":
      return "quota";
    case "EEXIST":
      return "exist";
    case "EFBIG":
      return "file-too-large";
    case "EILSEQ":
      return "illegal-byte-sequence";
    case "EINPROGRESS":
      return "in-progress";
    case "EINTR":
      return "interrupted";
    case "EINVAL":
      return "invalid";
    case "EIO":
      return "io";
    case "EISDIR":
      return "is-directory";
    case "ELOOP":
      return "loop";
    case "EMLINK":
      return "too-many-links";
    case "EMSGSIZE":
      return "message-size";
    case "ENAMETOOLONG":
      return "name-too-long";
    case "ENODEV":
      return "no-device";
    case "ENOENT":
      return "no-entry";
    case "ENOLCK":
      return "no-lock";
    case "ENOMEM":
      return "insufficient-memory";
    case "ENOSPC":
      return "insufficient-space";
    case "ENOTDIR":
    case "ERR_FS_EISDIR":
      return "not-directory";
    case "ENOTEMPTY":
      return "not-empty";
    case "ENOTRECOVERABLE":
      return "not-recoverable";
    case "ENOTSUP":
      return "unsupported";
    case "ENOTTY":
      return "no-tty";
    // windows gives this error for badly structured `//` reads
    // this seems like a slightly better error than unknown given
    // that it's a common footgun
    case -4094:
    case "ENXIO":
      return "no-such-device";
    case "EOVERFLOW":
      return "overflow";
    case "EPERM":
      return "not-permitted";
    case "EPIPE":
      return "pipe";
    case "EROFS":
      return "read-only";
    case "ESPIPE":
      return "invalid-seek";
    case "ETXTBSY":
      return "text-file-busy";
    case "EXDEV":
      return "cross-device";
    case "UNKNOWN":
      switch (e.errno) {
        case -4094:
          return "no-such-device";
        default:
          throw e;
      }
    default:
      throw e;
  }
}

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/preview2-shim/dist/browser/random.js
var MAX_BYTES = 65536;
var insecureRandomValue1;
var insecureRandomValue2;
var random = {
  getRandomBytes(len) {
    const bytes = new Uint8Array(Number(len));
    if (len > MAX_BYTES) {
      for (var generated = 0; generated < len; generated += MAX_BYTES) {
        crypto.getRandomValues(bytes.subarray(generated, generated + MAX_BYTES));
      }
    } else {
      crypto.getRandomValues(bytes);
    }
    return bytes;
  },
  getRandomU64() {
    return crypto.getRandomValues(new BigUint64Array(1))[0];
  },
  // @ts-expect-error Not defined in WIT
  insecureRandom() {
    if (insecureRandomValue1 === void 0 || insecureRandomValue2 === void 0) {
      insecureRandomValue1 = random.getRandomU64();
      insecureRandomValue2 = random.getRandomU64();
    }
    return [insecureRandomValue1, insecureRandomValue2];
  }
};

// ../../../tmp/tmp.Q58rLUOd2t/node_modules/@bytecodealliance/jco-transpile/vendor/js-component-bindgen-component.js
var { getEnvironment } = environment;
if (getEnvironment === void 0) {
  const err = new Error("unexpectedly undefined local import 'getEnvironment', was 'getEnvironment' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { exit: exit2 } = exit;
if (exit2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'exit', was 'exit' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStderr } = stderr;
if (getStderr === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStderr', was 'getStderr' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStdin } = stdin;
if (getStdin === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStdin', was 'getStdin' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStdout } = stdout;
if (getStdout === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStdout', was 'getStdout' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { TerminalInput: TerminalInput2 } = terminalInput;
if (TerminalInput2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'TerminalInput', was 'TerminalInput' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { TerminalOutput: TerminalOutput2 } = terminalOutput;
if (TerminalOutput2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'TerminalOutput', was 'TerminalOutput' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStderr } = terminalStderr;
if (getTerminalStderr === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStderr', was 'getTerminalStderr' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStdin } = terminalStdin;
if (getTerminalStdin === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStdin', was 'getTerminalStdin' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStdout } = terminalStdout;
if (getTerminalStdout === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStdout', was 'getTerminalStdout' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getDirectories } = preopens;
if (getDirectories === void 0) {
  const err = new Error("unexpectedly undefined local import 'getDirectories', was 'getDirectories' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var {
  Descriptor: Descriptor2,
  DirectoryEntryStream: DirectoryEntryStream2,
  filesystemErrorCode
} = types;
if (Descriptor2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'Descriptor', was 'Descriptor' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
if (DirectoryEntryStream2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'DirectoryEntryStream', was 'DirectoryEntryStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
if (filesystemErrorCode === void 0) {
  const err = new Error("unexpectedly undefined local import 'filesystemErrorCode', was 'filesystemErrorCode' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { Error: Error$1 } = error;
if (Error$1 === void 0) {
  const err = new Error("unexpectedly undefined local import 'Error$1', was 'Error' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var {
  InputStream: InputStream2,
  OutputStream: OutputStream2
} = streams;
if (InputStream2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'InputStream', was 'InputStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
if (OutputStream2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'OutputStream', was 'OutputStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getRandomBytes } = random;
if (getRandomBytes === void 0) {
  const err = new Error("unexpectedly undefined local import 'getRandomBytes', was 'getRandomBytes' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
function promiseWithResolvers() {
  if (Promise.withResolvers) {
    return Promise.withResolvers();
  } else {
    let resolve2;
    let reject2;
    const promise = new Promise((res, rej) => {
      resolve2 = res;
      reject2 = rej;
    });
    return { promise, resolve: resolve2, reject: reject2 };
  }
}
var symbolDispose3 = Symbol.dispose || Symbol.for("dispose");
var _debugLog = (...args) => {
  if (!globalThis?.process?.env?.JCO_DEBUG) {
    return;
  }
  console.debug(...args);
};
var ASYNC_DETERMINISM = "random";
var GLOBAL_COMPONENT_MEMORY_MAP = /* @__PURE__ */ new Map();
var CURRENT_TASK_META = {};
function _getGlobalCurrentTaskMeta(componentIdx2) {
  if (componentIdx2 === null || componentIdx2 === void 0) {
    throw new Error("missing/invalid component idx");
  }
  const v = CURRENT_TASK_META[componentIdx2];
  if (v === void 0 || v === null) {
    return void 0;
  }
  return { ...v };
}
function _setGlobalCurrentTaskMeta(args) {
  if (!args) {
    throw new TypeError("args missing");
  }
  if (args.taskID === void 0) {
    throw new TypeError("missing task ID");
  }
  if (args.componentIdx === void 0) {
    throw new TypeError("missing component idx");
  }
  const { taskID, componentIdx: componentIdx2 } = args;
  return CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
}
function _withGlobalCurrentTaskMeta(args) {
  _debugLog("[_withGlobalCurrentTaskMeta()] args", args);
  if (!args) {
    throw new TypeError("args missing");
  }
  if (args.taskID === void 0) {
    throw new TypeError("missing task ID");
  }
  if (args.componentIdx === void 0) {
    throw new TypeError("missing component idx");
  }
  if (!args.fn) {
    throw new TypeError("missing fn");
  }
  const { taskID, componentIdx: componentIdx2, fn } = args;
  try {
    CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
    return fn();
  } catch (err) {
    _debugLog("error while executing sync callee/callback", {
      ...args,
      err
    });
    throw err;
  } finally {
    CURRENT_TASK_META[componentIdx2] = null;
  }
}
async function _withGlobalCurrentTaskMetaAsync(args) {
  _debugLog("[_withGlobalCurrentTaskMetaAsync()] args", args);
  if (!args) {
    throw new TypeError("args missing");
  }
  if (args.taskID === void 0) {
    throw new TypeError("missing task ID");
  }
  if (args.componentIdx === void 0) {
    throw new TypeError("missing component idx");
  }
  if (!args.fn) {
    throw new TypeError("missing fn");
  }
  const { taskID, componentIdx: componentIdx2, fn } = args;
  try {
    CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
    return await fn();
  } catch (err) {
    _debugLog("error while executing async callee/callback", {
      ...args,
      err
    });
    throw err;
  } finally {
    CURRENT_TASK_META[componentIdx2] = null;
  }
}
async function _clearCurrentTask(args) {
  _debugLog("[_clearCurrentTask()] args", args);
  if (!args) {
    throw new TypeError("args missing");
  }
  if (args.taskID === void 0) {
    throw new TypeError("missing task ID");
  }
  if (args.componentIdx === void 0) {
    throw new TypeError("missing component idx");
  }
  const { taskID, componentIdx: componentIdx2 } = args;
  const meta = CURRENT_TASK_META[componentIdx2];
  if (!meta) {
    throw new Error(`missing current task meta for component idx [${componentIdx2}]`);
  }
  if (meta.taskID !== taskID) {
    throw new Error(`task ID [${meta.taskID}] != requested ID [${taskID}]`);
  }
  if (meta.componentIdx !== componentIdx2) {
    throw new Error(`component idx [${meta.componentIdx}] != requested idx [${componentIdx2}]`);
  }
  CURRENT_TASK_META[componentIdx2] = null;
}
function lookupMemoriesForComponent(args) {
  const { componentIdx: componentIdx2 } = args ?? {};
  if (args.componentIdx === void 0) {
    throw new TypeError("missing component idx");
  }
  const metas = GLOBAL_COMPONENT_MEMORY_MAP.get(componentIdx2);
  if (!metas) {
    return [];
  }
  if (args.memoryIdx === void 0) {
    return Object.values(metas);
  }
  const meta = metas[args.memoryIdx];
  return meta?.memory;
}
var RepTable = class {
  #data = [0, null];
  #size = 0;
  #target;
  constructor(args) {
    this.target = args?.target;
  }
  data() {
    return this.#data;
  }
  insert(val) {
    _debugLog("[RepTable#insert()] args", { val, target: this.target });
    const freeIdx = this.#data[0];
    if (freeIdx === 0) {
      this.#data.push(val);
      this.#data.push(null);
      const rep2 = (this.#data.length >> 1) - 1;
      _debugLog("[RepTable#insert()] inserted", { val, target: this.target, rep: rep2 });
      this.#size += 1;
      return rep2;
    }
    this.#data[0] = this.#data[freeIdx << 1];
    const placementIdx = freeIdx << 1;
    this.#data[placementIdx] = val;
    this.#data[placementIdx + 1] = null;
    _debugLog("[RepTable#insert()] inserted", { val, target: this.target, rep: freeIdx });
    this.#size += 1;
    return freeIdx;
  }
  get(rep2) {
    _debugLog("[RepTable#get()] args", { rep: rep2, target: this.target });
    if (rep2 === 0) {
      throw new Error("invalid resource rep during get, (cannot be 0)");
    }
    const baseIdx = rep2 << 1;
    const val = this.#data[baseIdx];
    return val;
  }
  contains(rep2) {
    _debugLog("[RepTable#contains()] args", { rep: rep2, target: this.target });
    if (rep2 === 0) {
      throw new Error("invalid resource rep during contains, (cannot be 0)");
    }
    const baseIdx = rep2 << 1;
    return !!this.#data[baseIdx];
  }
  remove(rep2) {
    _debugLog("[RepTable#remove()] args", { rep: rep2, target: this.target });
    if (rep2 === 0) {
      throw new Error("invalid resource rep during remove, (cannot be 0)");
    }
    if (this.#data.length === 2) {
      throw new Error("invalid");
    }
    const baseIdx = rep2 << 1;
    const val = this.#data[baseIdx];
    this.#data[baseIdx] = this.#data[0];
    this.#data[0] = rep2;
    this.#size -= 1;
    return val;
  }
  size() {
    return this.#size;
  }
  clear() {
    _debugLog("[RepTable#clear()] args", { rep, target: this.target });
    this.#data = [0, null];
  }
};
var _coinFlip = () => {
  return Math.random() > 0.5;
};
function _isValidNumericPrimitive(ty, v) {
  if (v === void 0 || v === null) {
    return false;
  }
  switch (ty) {
    case "bool":
      return v === 0 || v === 1;
      break;
    case "u8":
      return v >= 0 && v <= 255;
      break;
    case "s8":
      return v >= -128 && v <= 127;
      break;
    case "u16":
      return v >= 0 && v <= 65535;
      break;
    case "s16":
      return v >= -32768 && v <= 32767;
    case "u32":
      return v >= 0 && v <= 4294967295;
    case "s32":
      return v >= -2147483648 && v <= 2147483647;
    case "u64":
      return typeof v === "bigint" && v >= 0 && v <= 18446744073709551615n;
    case "s64":
      return typeof v === "bigint" && v >= -9223372036854775808n && v <= 9223372036854775807n;
      break;
    case "f32":
    case "f64":
      return typeof v === "number";
    default:
      return false;
  }
  return true;
}
function _requireValidNumericPrimitive(ty, v) {
  if (v === void 0 || v === null || !_isValidNumericPrimitive(ty, v)) {
    throw new TypeError(`invalid ${ty} value [${v}]`);
  }
  return true;
}
var ASYNC_FN_CTOR = (async () => {
}).constructor;
function clearCurrentTask(componentIdx2, taskID) {
  _debugLog("[clearCurrentTask()] args", { componentIdx: componentIdx2, taskID });
  if (componentIdx2 === void 0 || componentIdx2 === null) {
    throw new Error("missing/invalid component instance index while ending current task");
  }
  const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
  if (!tasks || !Array.isArray(tasks)) {
    throw new Error("missing/invalid tasks for component instance while ending task");
  }
  if (tasks.length == 0) {
    throw new Error(`no current tasks for component instance [${componentIdx2}] while ending task`);
  }
  if (taskID !== void 0) {
    const last = tasks[tasks.length - 1];
    if (last.id !== taskID) {
      return;
    }
  }
  ASYNC_CURRENT_TASK_IDS.pop();
  ASYNC_CURRENT_COMPONENT_IDXS.pop();
  const taskMeta = tasks.pop();
  return taskMeta.task;
}
var CURRENT_TASK_MAY_BLOCK = globalThis.WebAssembly ? new globalThis.WebAssembly.Global({ value: "i32", mutable: true }, 0) : false;
var ASYNC_CURRENT_TASK_IDS = [];
var ASYNC_CURRENT_COMPONENT_IDXS = [];
var AsyncSubtask = class _AsyncSubtask {
  static _ID = 0n;
  static State = {
    STARTING: 0,
    STARTED: 1,
    RETURNED: 2,
    CANCELLED_BEFORE_STARTED: 3,
    CANCELLED_BEFORE_RETURNED: 4
  };
  #id;
  #state = _AsyncSubtask.State.STARTING;
  #componentIdx;
  #parentTask;
  #childTask = null;
  #dropped = false;
  #cancelRequested = false;
  #memoryIdx = null;
  #lenders = null;
  #waitable = null;
  #callbackFn = null;
  #callbackFnName = null;
  #postReturnFn = null;
  #onProgressFn = null;
  #pendingEventFn = null;
  #callMetadata = {};
  #resolved = false;
  #onResolveHandlers = [];
  #onStartHandlers = [];
  #result = null;
  #resultSet = false;
  fnName;
  target;
  isAsync;
  isManualAsync;
  constructor(args) {
    if (typeof args.componentIdx !== "number") {
      throw new Error("invalid componentIdx for subtask creation");
    }
    this.#componentIdx = args.componentIdx;
    this.#id = ++_AsyncSubtask._ID;
    this.fnName = args.fnName;
    if (!args.parentTask) {
      throw new Error("missing parent task during subtask creation");
    }
    this.#parentTask = args.parentTask;
    if (args.childTask) {
      this.#childTask = args.childTask;
    }
    if (args.memoryIdx) {
      this.#memoryIdx = args.memoryIdx;
    }
    if (!args.waitable) {
      throw new Error("missing/invalid waitable");
    }
    this.#waitable = args.waitable;
    if (args.callMetadata) {
      this.#callMetadata = args.callMetadata;
    }
    this.#lenders = [];
    this.target = args.target;
    this.isAsync = args.isAsync;
    this.isManualAsync = args.isManualAsync;
  }
  id() {
    return this.#id;
  }
  parentTaskID() {
    return this.#parentTask?.id();
  }
  childTaskID() {
    return this.#childTask?.id();
  }
  state() {
    return this.#state;
  }
  waitable() {
    return this.#waitable;
  }
  waitableRep() {
    return this.#waitable.idx();
  }
  join() {
    return this.#waitable.join(...arguments);
  }
  getPendingEvent() {
    return this.#waitable.getPendingEvent(...arguments);
  }
  hasPendingEvent() {
    return this.#waitable.hasPendingEvent(...arguments);
  }
  setPendingEvent() {
    return this.#waitable.setPendingEvent(...arguments);
  }
  setTarget(tgt) {
    this.target = tgt;
  }
  getResult() {
    if (!this.#resultSet) {
      throw new Error("subtask result has not been set");
    }
    return this.#result;
  }
  setResult(v) {
    if (this.#resultSet) {
      throw new Error("subtask result has already been set");
    }
    this.#result = v;
    this.#resultSet = true;
  }
  componentIdx() {
    return this.#componentIdx;
  }
  setChildTask(t) {
    if (!t) {
      throw new Error("cannot set missing/invalid child task on subtask");
    }
    if (this.#childTask) {
      throw new Error("child task is already set on subtask");
    }
    if (this.#parentTask === t) {
      throw new Error("parent cannot be child");
    }
    this.#childTask = t;
  }
  getChildTask(t) {
    return this.#childTask;
  }
  getParentTask() {
    return this.#parentTask;
  }
  setCallbackFn(f, name) {
    if (!f) {
      return;
    }
    if (this.#callbackFn) {
      throw new Error("callback fn can only be set once");
    }
    this.#callbackFn = f;
    this.#callbackFnName = name;
  }
  getCallbackFnName() {
    if (!this.#callbackFn) {
      return void 0;
    }
    return this.#callbackFn.name;
  }
  setPostReturnFn(f) {
    if (!f) {
      return;
    }
    if (this.#postReturnFn) {
      throw new Error("postReturn fn can only be set once");
    }
    this.#postReturnFn = f;
  }
  setOnProgressFn(f) {
    if (this.#onProgressFn) {
      throw new Error("on progress fn can only be set once");
    }
    this.#onProgressFn = f;
  }
  isNotStarted() {
    return this.#state == _AsyncSubtask.State.STARTING;
  }
  registerOnStartHandler(f) {
    this.#onStartHandlers.push(f);
  }
  onStart(args) {
    _debugLog("[AsyncSubtask#onStart()] args", {
      componentIdx: this.#componentIdx,
      subtaskID: this.#id,
      parentTaskID: this.parentTaskID(),
      fnName: this.fnName,
      args
    });
    if (this.#onProgressFn) {
      this.#onProgressFn();
    }
    this.#state = _AsyncSubtask.State.STARTED;
    let result;
    if (this.#callMetadata.startFn) {
      result = this.#callMetadata.startFn.apply(null, args?.startFnParams ?? []);
    }
    return result;
  }
  registerOnResolveHandler(f) {
    this.#onResolveHandlers.push(f);
  }
  reject(subtaskErr) {
    this.#childTask?.reject(subtaskErr);
  }
  onResolve(subtaskValue) {
    _debugLog("[AsyncSubtask#onResolve()] args", {
      componentIdx: this.#componentIdx,
      subtaskID: this.#id,
      isAsync: this.isAsync,
      childTaskID: this.childTaskID(),
      parentTaskID: this.parentTaskID(),
      parentTaskFnName: this.#parentTask?.entryFnName(),
      fnName: this.fnName
    });
    if (this.#resolved) {
      throw new Error("subtask has already been resolved");
    }
    if (this.#onProgressFn) {
      this.#onProgressFn();
    }
    if (subtaskValue === null && this.#cancelRequested) {
      if (this.#state === _AsyncSubtask.State.STARTING) {
        this.#state = _AsyncSubtask.State.CANCELLED_BEFORE_STARTED;
      } else {
        if (this.#state !== _AsyncSubtask.State.STARTED) {
          throw new Error("resolved subtask must have been started before cancellation");
        }
        this.#state = _AsyncSubtask.State.CANCELLED_BEFORE_RETURNED;
      }
    } else {
      if (this.#state !== _AsyncSubtask.State.STARTED) {
        throw new Error("resolved subtask must have been started before completion");
      }
      this.#state = _AsyncSubtask.State.RETURNED;
    }
    this.setResult(subtaskValue);
    for (const f of this.#onResolveHandlers) {
      try {
        f(subtaskValue);
      } catch (err) {
        console.error("error during subtask resolve handler", err);
        throw err;
      }
    }
    const callMetadata = this.getCallMetadata();
    const memory = callMetadata.memory ?? this.#parentTask?.getReturnMemory() ?? lookupMemoriesForComponent({ componentIdx: this.#parentTask?.componentIdx() })[0];
    if (callMetadata && !callMetadata.returnFn && this.isAsync && callMetadata.resultPtr && memory) {
      const { resultPtr, realloc } = callMetadata;
      const lowers = callMetadata.lowers;
      if (lowers && lowers.length > 0) {
        lowers[0]({
          componentIdx: this.#componentIdx,
          memory,
          realloc,
          vals: [subtaskValue],
          storagePtr: resultPtr,
          stringEncoding: callMetadata.stringEncoding
        });
      }
    }
    this.#resolved = true;
    this.#parentTask.removeSubtask(this);
    if (!this.isAsync) {
      this.deliverResolve();
      const rep2 = this.waitableRep();
      if (rep2) {
        try {
          const removed = this.#getComponentState().handles.remove(rep2);
          if (removed !== this) {
            throw new Error("unexpectedly received non-self Subtask from handle removal");
          }
          this.drop();
        } catch (err) {
          _debugLog("[AsyncSubtask#onResolve()] failed to remove subtask after sync subtask completion", err);
        }
      }
    }
  }
  getStateNumber() {
    return this.#state;
  }
  isReturned() {
    return this.#state === _AsyncSubtask.State.RETURNED;
  }
  getCallMetadata() {
    return this.#callMetadata;
  }
  isResolved() {
    if (this.#state === _AsyncSubtask.State.STARTING || this.#state === _AsyncSubtask.State.STARTED) {
      return false;
    }
    if (this.#state === _AsyncSubtask.State.RETURNED || this.#state === _AsyncSubtask.State.CANCELLED_BEFORE_STARTED || this.#state === _AsyncSubtask.State.CANCELLED_BEFORE_RETURNED) {
      return true;
    }
    throw new Error("unrecognized internal Subtask state [" + this.#state + "]");
  }
  addLender(handle) {
    _debugLog("[AsyncSubtask#addLender()] args", { handle });
    if (!Number.isNumber(handle)) {
      throw new Error("missing/invalid lender handle [" + handle + "]");
    }
    if (this.#lenders.length === 0 || this.isResolved()) {
      throw new Error("subtask has no lendors or has already been resolved");
    }
    handle.lends++;
    this.#lenders.push(handle);
  }
  deliverResolve() {
    _debugLog("[AsyncSubtask#deliverResolve()] args", {
      lenders: this.#lenders,
      parentTaskID: this.parentTaskID(),
      subtaskID: this.#id,
      childTaskID: this.childTaskID(),
      resolved: this.isResolved(),
      resolveDelivered: this.resolveDelivered()
    });
    const cannotDeliverResolve = this.resolveDelivered() || !this.isResolved();
    if (cannotDeliverResolve) {
      throw new Error("subtask cannot deliver resolution twice, and the subtask must be resolved");
    }
    for (const lender of this.#lenders) {
      lender.lends--;
    }
    this.#lenders = null;
  }
  resolveDelivered() {
    _debugLog("[AsyncSubtask#resolveDelivered()] args", {});
    if (this.#lenders === null && !this.isResolved()) {
      throw new Error("invalid subtask state, lenders missing and subtask has not been resolved");
    }
    return this.#lenders === null;
  }
  drop() {
    _debugLog("[AsyncSubtask#drop()] args", {
      componentIdx: this.#componentIdx,
      parentTaskID: this.#parentTask?.id(),
      parentTaskFnName: this.#parentTask?.entryFnName(),
      childTaskID: this.#childTask?.id(),
      childTaskFnName: this.#childTask?.entryFnName(),
      subtaskFnName: this.fnName
    });
    if (!this.#waitable) {
      throw new Error("missing/invalid inner waitable");
    }
    if (!this.resolveDelivered()) {
      throw new Error("cannot drop subtask before resolve is delivered");
    }
    if (this.#waitable) {
      this.#waitable.drop();
    }
    this.#dropped = true;
  }
  #getComponentState() {
    const state = getOrCreateAsyncState(this.#componentIdx);
    if (!state) {
      throw new Error("invalid/missing async state for component [" + componentIdx + "]");
    }
    return state;
  }
  getWaitableHandleIdx() {
    _debugLog("[AsyncSubtask#getWaitableHandleIdx()] args", {});
    if (!this.#waitable) {
      throw new Error("missing/invalid waitable");
    }
    return this.waitableRep();
  }
};
var Waitable = class {
  #componentIdx;
  #pendingEventFn = null;
  #promise;
  #resolve;
  #reject;
  #waitableSet = null;
  #hasSyncWaiter = false;
  #idx = null;
  // to component-global waitables
  target;
  constructor(args) {
    const { componentIdx: componentIdx2, target } = args;
    this.#componentIdx = componentIdx2;
    this.target = args.target;
    this.#resetPromise();
  }
  componentIdx() {
    return this.#componentIdx;
  }
  isInSet() {
    return this.#waitableSet !== null;
  }
  idx() {
    return this.#idx;
  }
  setIdx(idx) {
    if (idx === 0) {
      throw new Error("waitable idx cannot be zero");
    }
    this.#idx = idx;
  }
  setTarget(tgt) {
    this.target = tgt;
  }
  #resetPromise() {
    const { promise, resolve: resolve2, reject: reject2 } = promiseWithResolvers();
    this.#promise = promise;
    this.#resolve = resolve2;
    this.#reject = reject2;
  }
  resolve() {
    this.#resolve();
  }
  reject(err) {
    this.#reject(err);
  }
  promise() {
    return this.#promise;
  }
  hasPendingEvent() {
    return this.#pendingEventFn !== null;
  }
  setPendingEvent(fn) {
    _debugLog("[Waitable#setPendingEvent()] args", {
      waitable: this,
      inSet: this.#waitableSet
    });
    this.#pendingEventFn = fn;
  }
  getPendingEvent() {
    _debugLog("[Waitable#getPendingEvent()] args", {
      waitable: this,
      inSet: this.#waitableSet,
      hasPendingEvent: this.#pendingEventFn !== null
    });
    if (this.#pendingEventFn === null) {
      return null;
    }
    const eventFn = this.#pendingEventFn;
    this.#pendingEventFn = null;
    const e = eventFn();
    this.#resetPromise();
    return e;
  }
  join(waitableSet) {
    _debugLog("[Waitable#join()] args", {
      waitable: this,
      waitableSet,
      isRemoval: waitableSet === null
    });
    if (this.#waitableSet === void 0) {
      throw new TypeError("waitable set must be not be undefined");
    }
    if (this.#waitableSet) {
      this.#waitableSet.removeWaitable(this);
    }
    this.#waitableSet = waitableSet;
    if (waitableSet) {
      this.#waitableSet.addWaitable(this);
    }
  }
  drop() {
    _debugLog("[Waitable#drop()] args", {
      componentIdx: this.#componentIdx,
      waitable: this
    });
    if (this.hasPendingEvent()) {
      throw new Error("waitables with pending events cannot be dropped");
    }
    this.join(null);
  }
  async waitForPendingEvent(args) {
    const { cstate } = args;
    if (!cstate) {
      throw new TypeError("missing component state");
    }
    if (this.#waitableSet !== null || this.#hasSyncWaiter) {
      throw new Error("waitable is already in a set/has a sync waiter");
    }
    this.#hasSyncWaiter = true;
    await cstate.waitUntil({
      cancellable: false,
      readyFn: () => this.hasPendingEvent()
    });
    this.#hasSyncWaiter = false;
  }
};
var ASYNC_TASKS_BY_COMPONENT_IDX = /* @__PURE__ */ new Map();
var AsyncTask = class _AsyncTask {
  static _ID = 0n;
  static State = {
    INITIAL: "initial",
    CANCELLED: "cancelled",
    CANCEL_PENDING: "cancel-pending",
    CANCEL_DELIVERED: "cancel-delivered",
    RESOLVED: "resolved"
  };
  static BlockResult = {
    CANCELLED: "block.cancelled",
    NOT_CANCELLED: "block.not-cancelled"
  };
  #id;
  #componentIdx;
  #state;
  #isAsync;
  #isManualAsync;
  #entryFnName = null;
  #onResolveHandlers = [];
  #completionPromise = null;
  #rejected = false;
  #exitPromise = null;
  #onExitHandlers = [];
  #memoryIdx = null;
  #memory = null;
  #callbackFn = null;
  #callbackFnName = null;
  #postReturnFn = null;
  #getCalleeParamsFn = null;
  #stringEncoding = null;
  #parentSubtask = null;
  #errHandling;
  #backpressurePromise;
  #backpressureWaiters = 0n;
  #returnLowerFns = null;
  #subtasks = [];
  #entered = false;
  #exited = false;
  #errored = null;
  cancelled = false;
  cancelRequested = false;
  alwaysTaskReturn = false;
  returnCalls = 0;
  storage = [0, 0];
  borrowedHandles = {};
  tmpRetI64HighBits = 0 | 0;
  constructor(opts) {
    this.#id = ++_AsyncTask._ID;
    if (opts?.componentIdx === void 0) {
      throw new TypeError("missing component id during task creation");
    }
    this.#componentIdx = opts.componentIdx;
    this.#state = _AsyncTask.State.INITIAL;
    this.#isAsync = opts?.isAsync ?? false;
    this.#isManualAsync = opts?.isManualAsync ?? false;
    this.#entryFnName = opts.entryFnName;
    const {
      promise: completionPromise,
      resolve: resolveCompletionPromise,
      reject: rejectCompletionPromise
    } = promiseWithResolvers();
    this.#completionPromise = completionPromise;
    this.#onResolveHandlers.push((results) => {
      if (this.#parentSubtask !== null) {
        return;
      }
      if (!this.#isAsync) {
        return;
      }
      if (this.#errored !== null) {
        rejectCompletionPromise(this.#errored);
        return;
      } else if (this.#rejected) {
        rejectCompletionPromise(results);
        return;
      }
      resolveCompletionPromise(results);
    });
    const {
      promise: exitPromise,
      resolve: resolveExitPromise,
      reject: rejectExitPromise
    } = promiseWithResolvers();
    this.#exitPromise = exitPromise;
    this.#onExitHandlers.push(() => {
      resolveExitPromise();
    });
    if (opts.callbackFn) {
      this.#callbackFn = opts.callbackFn;
    }
    if (opts.callbackFnName) {
      this.#callbackFnName = opts.callbackFnName;
    }
    if (opts.getCalleeParamsFn) {
      this.#getCalleeParamsFn = opts.getCalleeParamsFn;
    }
    if (opts.stringEncoding) {
      this.#stringEncoding = opts.stringEncoding;
    }
    if (opts.parentSubtask) {
      this.#parentSubtask = opts.parentSubtask;
    }
    if (opts.errHandling) {
      this.#errHandling = opts.errHandling;
    }
  }
  taskState() {
    return this.#state;
  }
  id() {
    return this.#id;
  }
  componentIdx() {
    return this.#componentIdx;
  }
  entryFnName() {
    return this.#entryFnName;
  }
  completionPromise() {
    return this.#completionPromise;
  }
  exitPromise() {
    return this.#exitPromise;
  }
  isAsync() {
    return this.#isAsync;
  }
  isSync() {
    return !this.isAsync();
  }
  getErrHandling() {
    return this.#errHandling;
  }
  hasCallback() {
    return this.#callbackFn !== null;
  }
  getReturnMemoryIdx() {
    return this.#memoryIdx;
  }
  setReturnMemoryIdx(idx) {
    if (idx === null) {
      return;
    }
    this.#memoryIdx = idx;
  }
  getReturnMemory() {
    return this.#memory;
  }
  setReturnMemory(m) {
    if (m === null) {
      return;
    }
    this.#memory = m;
  }
  setReturnLowerFns(fns) {
    this.#returnLowerFns = fns;
  }
  getReturnLowerFns() {
    return this.#returnLowerFns;
  }
  setParentSubtask(subtask) {
    if (!subtask || !(subtask instanceof AsyncSubtask)) {
      return;
    }
    if (this.#parentSubtask) {
      throw new Error("parent subtask can only be set once");
    }
    this.#parentSubtask = subtask;
  }
  getParentSubtask() {
    return this.#parentSubtask;
  }
  // TODO(threads): this is very inefficient, we can pass along a root task,
  // and ideally do not need this once thread support is in place
  getRootTask() {
    let currentSubtask = this.getParentSubtask();
    let task = this;
    while (currentSubtask) {
      task = currentSubtask.getParentTask();
      currentSubtask = task.getParentSubtask();
    }
    return task;
  }
  setPostReturnFn(f) {
    if (!f) {
      return;
    }
    if (this.#postReturnFn) {
      throw new Error("postReturn fn can only be set once");
    }
    this.#postReturnFn = f;
  }
  setCallbackFn(f, name) {
    if (!f) {
      return;
    }
    if (this.#callbackFn) {
      throw new Error("callback fn can only be set once");
    }
    this.#callbackFn = f;
    this.#callbackFnName = name;
  }
  getCallbackFnName() {
    if (!this.#callbackFnName) {
      return void 0;
    }
    return this.#callbackFnName;
  }
  async runCallbackFn(...args) {
    if (!this.#callbackFn) {
      throw new Error("no callback function has been set for task");
    }
    return _withGlobalCurrentTaskMetaAsync({
      taskID: this.#id,
      componentIdx: this.#componentIdx,
      fn: () => {
        return this.#callbackFn.apply(null, args);
      }
    });
  }
  getCalleeParams() {
    if (!this.#getCalleeParamsFn) {
      throw new Error("missing/invalid getCalleeParamsFn");
    }
    return this.#getCalleeParamsFn();
  }
  mayBlock() {
    return this.isAsync() || this.isResolvedState();
  }
  mayEnter(task) {
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    if (cstate.hasBackpressure()) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to backpressure", { taskID: this.#id });
      return false;
    }
    if (!cstate.callingSyncImport()) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to sync import call", { taskID: this.#id });
      return false;
    }
    const callingSyncExportWithSyncPending = cstate.callingSyncExport && !task.isAsync;
    if (!callingSyncExportWithSyncPending) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to sync export w/ sync pending", { taskID: this.#id });
      return false;
    }
    return true;
  }
  enterSync() {
    if (this.needsExclusiveLock()) {
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      cstate.exclusiveLock();
    }
    return true;
  }
  async enter(opts) {
    _debugLog("[AsyncTask#enter()] args", {
      taskID: this.#id,
      componentIdx: this.#componentIdx,
      subtaskID: this.getParentSubtask()?.id(),
      args: opts,
      entryFnName: this.#entryFnName
    });
    if (this.#entered) {
      throw new Error(`task with ID [${this.#id}] should not be entered twice`);
    }
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    if (opts?.isHost) {
      this.#entered = true;
      return this.#entered;
    }
    await cstate.nextTaskExecutionSlot({ task: this });
    if (this.isSync()) {
      this.#entered = true;
      if (this.#isManualAsync) {
        if (this.needsExclusiveLock()) {
          cstate.exclusiveLock();
        }
      }
      return this.#entered;
    }
    if (cstate.hasBackpressure() || this.needsExclusiveLock() && cstate.isExclusivelyLocked()) {
      cstate.addBackpressureWaiter();
      const result = await this.waitUntil({
        readyFn: () => {
          return !(cstate.hasBackpressure() || this.needsExclusiveLock() && cstate.isExclusivelyLocked());
        },
        cancellable: true
      });
      cstate.removeBackpressureWaiter();
      if (result === _AsyncTask.BlockResult.CANCELLED) {
        this.cancel();
        return false;
      }
    }
    try {
      if (this.needsExclusiveLock()) {
        cstate.exclusiveLock();
      }
    } catch {
      while (cstate.hasBackpressure() || this.needsExclusiveLock() && cstate.isExclusivelyLocked()) {
        try {
          if (this.needsExclusiveLock()) {
            cstate.exclusiveLock();
          }
          break;
        } catch (err) {
          cstate.addBackpressureWaiter();
          const result = await this.waitUntil({
            readyFn: () => {
              return !(cstate.hasBackpressure() || this.needsExclusiveLock() && cstate.isExclusivelyLocked());
            },
            cancellable: true
          });
          cstate.removeBackpressureWaiter();
          if (result === _AsyncTask.BlockResult.CANCELLED) {
            this.cancel();
            return false;
          }
        }
      }
    }
    this.#entered = true;
    return this.#entered;
  }
  isRunningState() {
    return this.#state !== _AsyncTask.State.RESOLVED;
  }
  isResolvedState() {
    return this.#state === _AsyncTask.State.RESOLVED;
  }
  isResolved() {
    return this.#state === _AsyncTask.State.RESOLVED;
  }
  async waitUntil(opts) {
    const { readyFn, cancellable } = opts;
    _debugLog("[AsyncTask#waitUntil()] args", { taskID: this.#id, args: { cancellable } });
    const keepGoing = await this.suspendUntil({
      readyFn,
      cancellable
    });
    return keepGoing;
  }
  async yieldUntil(opts) {
    const { readyFn, cancellable } = opts;
    _debugLog("[AsyncTask#yieldUntil()]", {
      taskID: this.#id,
      args: {
        cancellable
      },
      componentIdx: this.#componentIdx
    });
    const keepGoing = await this.suspendUntil({ readyFn, cancellable });
    if (keepGoing) {
      return {
        code: ASYNC_EVENT_CODE.NONE,
        payload0: 0,
        payload1: 0
      };
    }
    return {
      code: ASYNC_EVENT_CODE.TASK_CANCELLED,
      payload0: 0,
      payload1: 0
    };
  }
  async suspendUntil(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#suspendUntil()] args", {
      taskID: this.#id,
      args: {
        cancellable
      },
      componentIdx: this.#componentIdx
    });
    const pendingCancelled = this.deliverPendingCancel({ cancellable });
    if (pendingCancelled) {
      return false;
    }
    const completed = await this.immediateSuspendUntil({ readyFn, cancellable });
    return completed;
  }
  // TODO(threads): equivalent to thread.suspend_until()
  async immediateSuspendUntil(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#immediateSuspendUntil()] args", {
      args: {
        cancellable,
        readyFn
      },
      taskID: this.#id,
      componentIdx: this.#componentIdx
    });
    const ready = readyFn();
    if (ready && ASYNC_DETERMINISM === "random") {
      const coinFlip = _coinFlip();
      if (coinFlip) {
        return true;
      }
    }
    const keepGoing = await this.immediateSuspend({ cancellable, readyFn });
    return keepGoing;
  }
  async immediateSuspend(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#immediateSuspend()] args", { cancellable, readyFn });
    const pendingCancelled = this.deliverPendingCancel({ cancellable });
    if (pendingCancelled) {
      return false;
    }
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    const keepGoing = await cstate.suspendTask({ task: this, readyFn });
    return keepGoing;
  }
  deliverPendingCancel(opts) {
    const { cancellable } = opts;
    _debugLog("[AsyncTask#deliverPendingCancel()]", {
      args: { cancellable },
      taskID: this.#id,
      componentIdx: this.#componentIdx
    });
    if (cancellable && this.#state === _AsyncTask.State.PENDING_CANCEL) {
      this.#state = _AsyncTask.State.CANCEL_DELIVERED;
      return true;
    }
    return false;
  }
  isCancelled() {
    return this.cancelled;
  }
  cancel(args) {
    _debugLog("[AsyncTask#cancel()] args", {});
    if (this.taskState() !== _AsyncTask.State.CANCEL_DELIVERED) {
      throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}] invalid task state [${this.taskState()}] for cancellation`);
    }
    if (this.borrowedHandles.length > 0) {
      throw new Error("task still has borrow handles");
    }
    this.cancelled = true;
    this.onResolve(args?.error ?? new Error("task cancelled"));
    this.#state = _AsyncTask.State.RESOLVED;
  }
  onResolve(taskValue) {
    const handlers = this.#onResolveHandlers;
    this.#onResolveHandlers = [];
    for (const f of handlers) {
      try {
        f(taskValue);
      } catch (err) {
        _debugLog("[AsyncTask#onResolve] error during task resolve handler", err);
        throw err;
      }
    }
    if (this.#parentSubtask) {
      const meta = this.#parentSubtask.getCallMetadata();
      if (meta.returnFn && !meta.returnFnCalled) {
        _debugLog("[AsyncTask#onResolve()] running returnFn", {
          componentIdx: this.#componentIdx,
          taskID: this.#id,
          subtaskID: this.#parentSubtask.id()
        });
        const memory = meta.getMemoryFn();
        meta.returnFn.apply(null, [taskValue, meta.resultPtr]);
        meta.returnFnCalled = true;
      }
    }
    if (this.#postReturnFn) {
      _debugLog("[AsyncTask#onResolve()] running post return ", {
        componentIdx: this.#componentIdx,
        taskID: this.#id
      });
      try {
        this.#postReturnFn(taskValue);
      } catch (err) {
        _debugLog("[AsyncTask#onResolve] error during task resolve handler", err);
        throw err;
      }
    }
    if (this.#parentSubtask) {
      this.#parentSubtask.onResolve(taskValue);
    }
  }
  registerOnResolveHandler(f) {
    this.#onResolveHandlers.push(f);
  }
  isRejected() {
    return this.#rejected;
  }
  isErrored() {
    return this.#errored;
  }
  setErrored(err) {
    this.#errored = err;
  }
  reject(taskErr) {
    _debugLog("[AsyncTask#reject()] args", {
      componentIdx: this.#componentIdx,
      taskID: this.#id,
      parentSubtask: this.#parentSubtask,
      parentSubtaskID: this.#parentSubtask?.id(),
      entryFnName: this.entryFnName(),
      callbackFnName: this.#callbackFnName,
      errMsg: taskErr.message
    });
    if (this.isResolvedState() || this.#rejected) {
      return;
    }
    this.#rejected = true;
    this.cancelRequested = true;
    this.#state = _AsyncTask.State.PENDING_CANCEL;
    const cancelled = this.deliverPendingCancel({ cancellable: true });
    this.cancel({ error: taskErr });
  }
  resolve(results) {
    _debugLog("[AsyncTask#resolve()] args", {
      componentIdx: this.#componentIdx,
      taskID: this.#id,
      entryFnName: this.entryFnName(),
      callbackFnName: this.#callbackFnName
    });
    if (this.#state === _AsyncTask.State.RESOLVED) {
      throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}]  is already resolved (did you forget to wait for an import?)`);
    }
    if (this.borrowedHandles.length > 0) {
      throw new Error("task still has borrow handles");
    }
    this.#state = _AsyncTask.State.RESOLVED;
    switch (results.length) {
      case 0:
        this.onResolve(void 0);
        break;
      case 1:
        this.onResolve(results[0]);
        break;
      default:
        _debugLog("[AsyncTask#resolve()] unexpected number of results", {
          componentIdx: this.#componentIdx,
          results,
          taskID: this.#id,
          subtaskID: this.#parentSubtask?.id(),
          entryFnName: this.#entryFnName,
          callbackFnName: this.#callbackFnName
        });
        throw new Error("unexpected number of results");
    }
  }
  exit(args) {
    _debugLog("[AsyncTask#exit()]", {
      componentIdx: this.#componentIdx,
      taskID: this.#id
    });
    if (this.#exited) {
      throw new Error("task has already exited");
    }
    if (this.#state !== _AsyncTask.State.RESOLVED) {
      throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}] exited without resolution`);
    }
    if (this.borrowedHandles > 0) {
      throw new Error("task [${this.#id}] exited without clearing borrowed handles");
    }
    const state = getOrCreateAsyncState(this.#componentIdx);
    if (!state) {
      throw new Error("missing async state for component [" + this.#componentIdx + "]");
    }
    if (this.#componentIdx !== -1 && !args?.skipExclusiveLockCheck) {
      if (this.needsExclusiveLock() && !state.isExclusivelyLocked()) {
        throw new Error(`task [${this.#id}] exit: component [${this.#componentIdx}] should have been exclusively locked`);
      }
    }
    state.exclusiveRelease();
    for (const f of this.#onExitHandlers) {
      try {
        f();
      } catch (err) {
        console.error("error during task exit handler", err);
        throw err;
      }
    }
    this.#exited = true;
    clearCurrentTask(this.#componentIdx, this.id());
  }
  needsExclusiveLock() {
    return !this.#isAsync || this.hasCallback();
  }
  createSubtask(args) {
    _debugLog("[AsyncTask#createSubtask()] args", args);
    const { componentIdx: componentIdx2, childTask, callMetadata, fnName, isAsync, isManualAsync } = args;
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    if (!cstate) {
      throw new Error(`invalid/missing async state for component idx [${componentIdx2}]`);
    }
    const waitable = new Waitable({
      componentIdx: this.#componentIdx,
      target: `subtask (internal ID [${this.#id}])`
    });
    const newSubtask = new AsyncSubtask({
      componentIdx: componentIdx2,
      childTask,
      parentTask: this,
      callMetadata,
      isAsync,
      isManualAsync,
      fnName,
      waitable
    });
    this.#subtasks.push(newSubtask);
    newSubtask.setTarget(`subtask (internal ID [${newSubtask.id()}], waitable [${waitable.idx()}], component [${componentIdx2}])`);
    waitable.setIdx(cstate.handles.insert(newSubtask));
    waitable.setTarget(`waitable for subtask (waitable id [${waitable.idx()}], subtask internal ID [${newSubtask.id()}])`);
    return newSubtask;
  }
  getLatestSubtask() {
    return this.#subtasks.at(-1);
  }
  getSubtaskByWaitableRep(rep2) {
    if (rep2 === void 0) {
      throw new TypeError("missing rep");
    }
    return this.#subtasks.find((s) => s.waitableRep() === rep2);
  }
  currentSubtask() {
    _debugLog("[AsyncTask#currentSubtask()]");
    if (this.#subtasks.length === 0) {
      return void 0;
    }
    return this.#subtasks.at(-1);
  }
  removeSubtask(subtask) {
    if (this.#subtasks.length === 0) {
      throw new Error("cannot end current subtask: no current subtask");
    }
    this.#subtasks = this.#subtasks.filter((t) => t !== subtask);
    return subtask;
  }
};
var ASYNC_EVENT_CODE = {
  NONE: 0,
  SUBTASK: 1,
  STREAM_READ: 2,
  STREAM_WRITE: 3,
  FUTURE_READ: 4,
  FUTURE_WRITE: 5,
  TASK_CANCELLED: 6
};
function getCurrentTask(componentIdx2, taskID) {
  let usedGlobal = false;
  if (componentIdx2 === void 0 || componentIdx2 === null) {
    throw new Error("missing component idx");
  }
  const taskMetas = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
  if (taskMetas === void 0 || taskMetas.length === 0) {
    return void 0;
  }
  if (taskID) {
    return taskMetas.find((meta) => meta.task.id() === taskID);
  }
  const taskMeta = taskMetas[taskMetas.length - 1];
  if (!taskMeta || !taskMeta.task) {
    return void 0;
  }
  return taskMeta;
}
var dv = new DataView(new ArrayBuffer());
var dataView = (mem) => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);
function toUint64(val) {
  const converted = BigInt(val);
  return BigInt.asUintN(64, converted);
}
function toUint32(val) {
  return val >>> 0;
}
var utf16Decoder = new TextDecoder("utf-16");
function _utf16AllocateAndEncode(str, realloc, memory) {
  const len = str.length;
  const ptr = realloc(0, 0, 2, len * 2);
  const out = new Uint16Array(memory.buffer, ptr, len);
  let i = 0;
  if (isLE) {
    while (i < len) {
      out[i] = str.charCodeAt(i++);
    }
  } else {
    while (i < len) {
      const ch = str.charCodeAt(i);
      out[i++] = (ch & 255) << 8 | ch >>> 8;
    }
  }
  return { ptr, len, codepoints: [...str].length };
}
var TEXT_DECODER_UTF8 = new TextDecoder();
var TEXT_ENCODER_UTF8 = new TextEncoder();
function _utf8AllocateAndEncode(s, realloc, memory) {
  if (typeof s !== "string") {
    throw new TypeError("expected a string, received [" + typeof s + "]");
  }
  if (s.length === 0) {
    return { ptr: 1, len: 0 };
  }
  let buf = TEXT_ENCODER_UTF8.encode(s);
  let ptr = realloc(0, 0, 1, buf.length);
  new Uint8Array(memory.buffer).set(buf, ptr);
  const res = { ptr, len: buf.length, codepoints: [...s].length };
  return res;
}
var T_FLAG = 1 << 30;
function rscTableCreateOwn(table, rep2) {
  const free = table[0] & ~T_FLAG;
  table._createdReps.add(rep2);
  if (free === 0) {
    table.push(0);
    table.push(rep2 | T_FLAG);
    return (table.length >> 1) - 1;
  }
  table[0] = table[free << 1];
  table[free << 1] = 0;
  table[(free << 1) + 1] = rep2 | T_FLAG;
  return free;
}
function rscTableRemove(table, handle) {
  const scope = table[handle << 1];
  const val = table[(handle << 1) + 1];
  const own = (val & T_FLAG) !== 0;
  const rep2 = val & ~T_FLAG;
  if (val === 0 || (scope & T_FLAG) !== 0) {
    throw new TypeError("Invalid handle");
  }
  table[handle << 1] = table[0] | T_FLAG;
  table[0] = handle | T_FLAG;
  return { rep: rep2, scope, own };
}
var curResourceBorrows = [];
function createNewCurrentTask(args) {
  _debugLog("[createNewCurrentTask()] args", args);
  const {
    componentIdx: componentIdx2,
    isAsync,
    isManualAsync,
    entryFnName,
    parentSubtaskID,
    callbackFnName,
    getCallbackFn,
    getParamsFn,
    stringEncoding,
    errHandling,
    getCalleeParamsFn,
    resultPtr,
    callingWasmExport
  } = args;
  if (componentIdx2 === void 0 || componentIdx2 === null) {
    throw new Error("missing/invalid component instance index while starting task");
  }
  let taskMetas = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
  const callbackFn = getCallbackFn ? getCallbackFn() : null;
  const newTask = new AsyncTask({
    componentIdx: componentIdx2,
    isAsync,
    isManualAsync,
    entryFnName,
    callbackFn,
    callbackFnName,
    stringEncoding,
    getCalleeParamsFn,
    resultPtr,
    errHandling
  });
  const newTaskID = newTask.id();
  const newTaskMeta = { id: newTaskID, componentIdx: componentIdx2, task: newTask };
  ASYNC_CURRENT_TASK_IDS.push(newTaskID);
  ASYNC_CURRENT_COMPONENT_IDXS.push(componentIdx2);
  if (!taskMetas) {
    taskMetas = [newTaskMeta];
    ASYNC_TASKS_BY_COMPONENT_IDX.set(componentIdx2, [newTaskMeta]);
  } else {
    taskMetas.push(newTaskMeta);
  }
  return [newTask, newTaskID];
}
function _lowerImportBackwardsCompat(args) {
  const params = [...arguments].slice(1);
  _debugLog("[_lowerImportBackwardsCompat()] args", { args, params });
  const {
    functionIdx,
    componentIdx: componentIdx2,
    isAsync,
    isManualAsync,
    paramLiftFns,
    resultLowerFns,
    hasResultPointer,
    funcTypeIsAsync,
    metadata,
    memoryIdx,
    getMemoryFn,
    getReallocFn,
    importFn,
    stringEncoding
  } = args;
  let meta = _getGlobalCurrentTaskMeta(componentIdx2);
  let createdTask;
  if (!meta) {
    if (funcTypeIsAsync || isAsync && !isManualAsync) {
      throw new Error("p3 async wasm exports cannot use backwards compat auto-task init");
    }
    const [newTask, newTaskID] = createNewCurrentTask({
      componentIdx: componentIdx2,
      isAsync,
      isManualAsync,
      callingWasmExport: false
    });
    createdTask = newTask;
    createdTask.registerOnResolveHandler(() => {
      _clearCurrentTask({
        taskID: task.id(),
        componentIdx: task.componentIdx()
      });
    });
    _setGlobalCurrentTaskMeta({
      componentIdx: componentIdx2,
      taskID: newTaskID
    });
    meta = _getGlobalCurrentTaskMeta(componentIdx2);
  }
  const { taskID } = meta;
  const taskMeta = getCurrentTask(componentIdx2, taskID);
  if (!taskMeta) {
    throw new Error("invalid/missing async task meta");
  }
  const task = taskMeta.task;
  if (!task) {
    throw new Error("invalid/missing async task");
  }
  const cstate = getOrCreateAsyncState(componentIdx2);
  if (!task.mayBlock() && funcTypeIsAsync && !isAsync) {
    throw new Error("non async exports cannot synchronously call async functions");
  }
  const memory = getMemoryFn();
  const resultPtr = hasResultPointer ? params[params.length - 1] : void 0;
  const subtask = task.createSubtask({
    componentIdx: componentIdx2,
    parentTask: task,
    fnName: importFn.fnName,
    isAsync,
    isManualAsync,
    callMetadata: {
      memoryIdx,
      memory,
      realloc: getReallocFn?.(),
      getReallocFn,
      resultPtr,
      lowers: resultLowerFns,
      stringEncoding
    }
  });
  task.setReturnMemoryIdx(memoryIdx);
  task.setReturnMemory(getMemoryFn());
  subtask.onStart();
  if (!isManualAsync && !isAsync && !funcTypeIsAsync) {
    if (createdTask) {
      createdTask.enterSync();
    }
    const res = importFn(...params);
    if (!funcTypeIsAsync && !subtask.isReturned()) {
      throw new Error("post-execution subtasks must either be async or returned");
    }
    const syncRes = subtask.getResult();
    if (createdTask) {
      createdTask.resolve([syncRes]);
    }
    return syncRes;
  }
  if (!isManualAsync && !isAsync && funcTypeIsAsync) {
    const { promise, resolve: resolve2 } = new Promise();
    queueMicrotask(async () => {
      if (!subtask.isResolvedState()) {
        await task.suspendUntil({ readyFn: () => task.isResolvedState() });
      }
      resolve2(subtask.getResult());
    });
    return promise;
  }
  const subtaskState = subtask.getStateNumber();
  if (subtaskState < 0 || subtaskState >= 2 ** 4) {
    throw new Error("invalid subtask state, out of valid range");
  }
  subtask.setOnProgressFn(() => {
    subtask.setPendingEvent(() => {
      if (subtask.isResolved()) {
        subtask.deliverResolve();
      }
      const event = {
        code: ASYNC_EVENT_CODE.SUBTASK,
        payload0: subtask.waitableRep(),
        payload1: subtask.getStateNumber()
      };
      return event;
    });
  });
  const requiresManualAsyncResult = !isAsync && !funcTypeIsAsync && isManualAsync;
  let manualAsyncResult;
  if (requiresManualAsyncResult) {
    manualAsyncResult = promiseWithResolvers();
  }
  queueMicrotask(async () => {
    try {
      _debugLog("[_lowerImportBackwardsCompat()] calling lowered import", { importFn, params });
      if (createdTask) {
        await createdTask.enter();
      }
      const asyncRes = await importFn(...params);
      if (requiresManualAsyncResult) {
        manualAsyncResult.resolve(subtask.getResult());
      }
      if (createdTask) {
        createdTask.resolve([asyncRes]);
      }
    } catch (err) {
      _debugLog("[_lowerImportBackwardsCompat()] import fn error:", err);
      if (requiresManualAsyncResult) {
        manualAsyncResult.reject(err);
      }
      throw err;
    }
  });
  if (requiresManualAsyncResult) {
    return manualAsyncResult.promise;
  }
  return Number(subtask.waitableRep()) << 4 | subtaskState;
}
function _liftFlatU8(ctx) {
  _debugLog("[_liftFlatU8()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least a single i32 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < 1) {
    throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u8 requires 1 byte)`);
  }
  val = new DataView(ctx.memory.buffer).getUint8(ctx.storagePtr, true);
  ctx.storagePtr += 1;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 1;
  }
  return [val, ctx];
}
function _liftFlatU16(ctx) {
  _debugLog("[_liftFlatU16()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least a single i32 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < 2) {
    throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u16 requires 2 bytes)`);
  }
  val = new DataView(ctx.memory.buffer).getUint16(ctx.storagePtr, true);
  ctx.storagePtr += 2;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 2;
  }
  const rem = ctx.storagePtr % 2;
  if (rem !== 0) {
    ctx.storagePtr += 2 - rem;
  }
  return [val, ctx];
}
function _liftFlatU32(ctx) {
  _debugLog("[_liftFlatU32()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least a single i34 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < 4) {
    throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u32 requires 4 bytes)`);
  }
  val = new DataView(ctx.memory.buffer).getUint32(ctx.storagePtr, true);
  ctx.storagePtr += 4;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 4;
  }
  return [val, ctx];
}
function _liftFlatU64(ctx) {
  _debugLog("[_liftFlatU64()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least one single i64 argument");
    }
    if (typeof ctx.params[0] !== "bigint") {
      throw new Error("expected bigint");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < 8) {
    throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u64 requires 8 bytes)`);
  }
  val = new DataView(ctx.memory.buffer).getBigUint64(ctx.storagePtr, true);
  ctx.storagePtr += 8;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 8;
  }
  return [val, ctx];
}
function _liftFlatFloat64(ctx) {
  _debugLog("[_liftFlatFloat64()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least one single f64 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    if (ctx.inVariant) {
      const dv2 = new DataView(new ArrayBuffer(8));
      dv2.setBigInt64(0, val);
      val = dv2.getFloat64(0);
    }
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < 8) {
    throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (f64 requires 8 bytes)`);
  }
  val = new DataView(ctx.memory.buffer).getFloat64(ctx.storagePtr, true);
  ctx.storagePtr += 8;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 8;
  }
  return [val, ctx];
}
function _liftFlatStringAny(ctx) {
  switch (ctx.stringEncoding) {
    case "utf8":
      return _liftFlatStringUTF8(ctx);
    case "utf16":
      return _liftFlatStringUTF16(ctx);
    default:
      throw new Error(`missing/unrecognized/unsupported string encoding [${ctx.stringEncoding}]`);
  }
}
function _liftFlatStringUTF8(ctx) {
  _debugLog("[_liftFlatStringUTF8()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length < 2) {
      throw new Error("expected at least two u32 arguments");
    }
    let offset = ctx.params[0];
    if (typeof offset === "bigint") {
      offset = Number(offset);
    }
    if (!Number.isSafeInteger(offset)) {
      throw new Error("invalid offset");
    }
    const len = ctx.params[1];
    if (!Number.isSafeInteger(len)) {
      throw new Error("invalid len");
    }
    val = TEXT_DECODER_UTF8.decode(new DataView(ctx.memory.buffer, offset, len));
    ctx.params = ctx.params.slice(2);
    return [val, ctx];
  }
  const rem = ctx.storagePtr % 4;
  if (rem !== 0) {
    ctx.storagePtr += 4 - rem;
  }
  const dv2 = new DataView(ctx.memory.buffer);
  const start2 = dv2.getUint32(ctx.storagePtr, true);
  const codeUnits2 = dv2.getUint32(ctx.storagePtr + 4, true);
  val = TEXT_DECODER_UTF8.decode(new Uint8Array(ctx.memory.buffer, start2, codeUnits2));
  ctx.storagePtr += 8;
  if (ctx.storageLen !== void 0) {
    ctx.storagelen -= 8;
  }
  return [val, ctx];
}
function _liftFlatStringUTF16(ctx) {
  _debugLog("[_liftFlatStringUTF16()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length < 2) {
      throw new Error("expected at least two u32 arguments");
    }
    let offset = ctx.params[0];
    if (typeof offset === "bigint") {
      offset = Number(offset);
    }
    if (!Number.isSafeInteger(offset)) {
      throw new Error("invalid offset");
    }
    const len = ctx.params[1];
    if (!Number.isSafeInteger(len)) {
      throw new Error("invalid len");
    }
    val = utf16Decoder.decode(new DataView(ctx.memory.buffer, offset, len));
    ctx.params = ctx.params.slice(2);
    return [val, ctx];
  }
  const data = new DataView(ctx.memory.buffer);
  const start2 = data.getUint32(ctx.storagePtr, vals[0], true);
  const codeUnits2 = data.getUint32(ctx.storagePtr, vals[0] + 4, true);
  val = utf16Decoder.decode(new Uint16Array(ctx.memory.buffer, start2, codeUnits2));
  ctx.storagePtr = ctx.storagePtr + 2 * codeUnits2;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen = ctx.storageLen - 2 * codeUnits2;
  }
  return [val, ctx];
}
function _liftFlatVariant(meta) {
  const {
    caseMetas,
    variantSize32,
    variantAlign32,
    variantPayloadOffset32,
    variantFlatCount,
    isEnum
  } = meta;
  return function _liftFlatVariantInner(ctx) {
    _debugLog("[_liftFlatVariant()] args", { ctx });
    const origUseParams = ctx.useDirectParams;
    const wasInVariant = ctx.inVariant;
    ctx.inVariant = true;
    let caseIdx;
    let liftRes;
    const originalPtr = ctx.storagePtr;
    const numCases = caseMetas.length;
    if (caseMetas.length < 256) {
      liftRes = _liftFlatU8(ctx);
    } else if (numCases >= 256 && numCases < 65536) {
      liftRes = _liftFlatU16(ctx);
    } else if (numCases >= 65536 && numCases < 4294967296) {
      liftRes = _liftFlatU32(ctx);
    } else {
      throw new Error(`unsupported number of variant cases [${numCases}]`);
    }
    caseIdx = liftRes[0];
    ctx = liftRes[1];
    const [
      tag,
      liftFn,
      caseSize32,
      caseAlign32,
      caseFlatCount
    ] = caseMetas[caseIdx];
    if (variantPayloadOffset32 === void 0) {
      throw new Error("unexpectedly missing payload offset");
    }
    if (originalPtr !== void 0) {
      ctx.storagePtr = originalPtr + variantPayloadOffset32;
    }
    let val;
    if (liftFn === null) {
      val = { tag };
      if (originalPtr !== void 0) {
        ctx.storagePtr = originalPtr + variantSize32;
      }
    } else {
      if (ctx.useDirectParams && ctx.params && liftFn !== _liftFlatFloat64 && typeof ctx.params[0] === "bigint") {
        if (ctx.params[0] > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error(`invalid value, reinterpreted i32/f32 too large: [${ctx.params[0]}]`);
        }
        ctx.params[0] = Number(ctx.params[0]);
      }
      const [newVal, newCtx] = liftFn(ctx);
      val = { tag, val: newVal };
      ctx = newCtx;
    }
    if (origUseParams) {
      if (variantFlatCount === void 0 || variantFlatCount === null) {
        _debugLog("[_liftFlatVariant()] variant with unknown flat count", { ctx, meta });
        throw new Error("cannot lift variant with unknown flat count");
      }
      if (caseFlatCount === void 0 || caseFlatCount === null) {
        _debugLog("[_liftFlatVariant()] case with unknown flat count", { ctx, meta, case: meta.caseMetas[caseIdx] });
        throw new Error("cannot lift case with unknown flat count");
      }
      const remainingPayloadParams = variantFlatCount - caseFlatCount - (isEnum ? 0 : 1);
      if (remainingPayloadParams < 0) {
        throw new Error(`invalid variant flat count metadata`);
      }
      if (ctx.params.length < remainingPayloadParams) {
        throw new Error(`expected at least [${remainingPayloadParams}] remaining variant payload params, but got [${ctx.params.length}]`);
      }
      ctx.params = ctx.params.slice(remainingPayloadParams);
    }
    if (ctx.storagePtr !== void 0) {
      const rem = ctx.storagePtr % variantAlign32;
      if (rem !== 0) {
        ctx.storagePtr += variantAlign32 - rem;
      }
    }
    ctx.inVariant = wasInVariant;
    return [val, ctx];
  };
}
function _liftFlatList(meta) {
  const { elemLiftFn, elemSize32, elemAlign32, knownLen, typedArray } = meta;
  const listValue = typedArray === void 0 ? (values) => values : (values) => new typedArray(values);
  const readValuesAndReset = (ctx, originalPtr, originalLen, dataPtr, len) => {
    ctx.storagePtr = dataPtr;
    const val = [];
    for (var i = 0; i < len; i++) {
      const elemPtr = dataPtr + i * elemSize32;
      ctx.storagePtr = elemPtr;
      const [res, nextCtx] = elemLiftFn(ctx);
      val.push(res);
      ctx = nextCtx;
      ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
    }
    if (originalPtr !== null) {
      ctx.storagePtr = originalPtr;
    }
    if (originalLen !== null) {
      ctx.storageLen = originalLen;
    }
    return [listValue(val), ctx];
  };
  return function _liftFlatListInner(ctx) {
    _debugLog("[_liftFlatList()] args", { ctx });
    let liftResults;
    if (knownLen !== void 0) {
      if (ctx.useDirectParams) {
        _debugLog("memory unexpectedly missing while lifting unknown length list", { ctx });
        liftResults = [listValue(ctx.params.slice(0, knownLen)), ctx];
        ctx.params = ctx.params.slice(knownLen);
      } else {
        if (ctx.memory === null) {
          _debugLog("memory unexpectedly missing while lifting known length list", { knownLen, ctx });
          throw new Error(`memory missing while lifting known length (${knownLen}) list`);
        }
        const originalLen = ctx.storageLen;
        const originalPtr = ctx.storagePtr;
        ctx.storageLen = knownLen * elemSize32;
        liftResults = readValuesAndReset(ctx, null, originalLen, ctx.storagePtr, knownLen);
      }
    } else {
      if (ctx.useDirectParams) {
        const dataPtr = ctx.params[0];
        const len = ctx.params[1];
        ctx.params = ctx.params.slice(2);
        ctx.useDirectParams = false;
        const originalPtr = ctx.storagePtr;
        const originalLen = ctx.storageLen;
        ctx.storageLen = len * elemSize32;
        liftResults = readValuesAndReset(ctx, originalPtr, originalLen, dataPtr, len);
        ctx.useDirectParams = true;
      } else {
        const originalLen = ctx.storageLen;
        ctx.storageLen = 8;
        const dataPtrLiftRes = _liftFlatU32(ctx);
        const dataPtr = dataPtrLiftRes[0];
        ctx = dataPtrLiftRes[1];
        const lenLiftRes = _liftFlatU32(ctx);
        const len = lenLiftRes[0];
        ctx = lenLiftRes[1];
        const originalPtr = ctx.storagePtr;
        ctx.storagePtr = dataPtr;
        ctx.storageLen = len * elemSize32;
        liftResults = readValuesAndReset(ctx, originalPtr, originalLen, dataPtr, len);
      }
    }
    return liftResults;
  };
}
function _liftFlatFlags(meta) {
  const { names, size32, align32, intSizeBytes } = meta;
  return function _liftFlatFlagsInner(ctx) {
    _debugLog("[_liftFlatFlags()] args", { ctx });
    const val = {};
    let liftRes;
    let align;
    switch (intSizeBytes) {
      case 1:
        liftRes = _liftFlatU8(ctx);
        break;
      case 2:
        liftRes = _liftFlatU16(ctx);
        break;
      case 4:
        liftRes = _liftFlatU32(ctx);
        break;
      default:
        throw new Error("invalid flags size");
    }
    let bits = liftRes[0];
    ctx = liftRes[1];
    for (const name of names) {
      val[name] = (bits & 1) === 1;
      bits >>>= 1;
    }
    const rem = ctx.storagePtr % align32;
    if (rem !== 0) {
      ctx.storagePtr += align32 - rem;
    }
    return [val, ctx];
  };
}
function _liftFlatResult(meta) {
  const f = _liftFlatVariant(meta);
  return function _liftFlatResultInner(ctx) {
    _debugLog("[_liftFlatResult()] args", { ctx });
    return f(ctx);
  };
}
function _liftFlatBorrow(componentTableIdx, size, memory, vals2, storagePtr, storageLen) {
  _debugLog("[_liftFlatBorrow()] args", { size, memory, vals: vals2, storagePtr, storageLen });
  throw new Error("flat lift for borrowed resources is not supported!");
}
function _lowerFlatU8(ctx) {
  _debugLog("[_lowerFlatU8()] args", ctx);
  if (ctx.vals.length !== 1) {
    throw new Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
  }
  _requireValidNumericPrimitive.bind("u8", ctx.vals[0]);
  if (!ctx.memory) {
    throw new Error("missing memory for lower");
  }
  new DataView(ctx.memory.buffer).setUint32(ctx.storagePtr, ctx.vals[0], true);
  ctx.storagePtr += 1;
}
function _lowerFlatU16(ctx) {
  _debugLog("[_lowerFlatU16()] args", { ctx });
  if (!ctx.memory) {
    throw new Error("missing memory for lower");
  }
  if (ctx.vals.length !== 1) {
    throw new Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
  }
  const rem = ctx.storagePtr % 2;
  if (rem !== 0) {
    ctx.storagePtr += 2 - rem;
  }
  _requireValidNumericPrimitive.bind("u16", ctx.vals[0]);
  new DataView(ctx.memory.buffer).setUint16(ctx.storagePtr, ctx.vals[0], true);
  ctx.storagePtr += 2;
}
function _lowerFlatU32(ctx) {
  _debugLog("[_lowerFlatU32()] args", { ctx });
  if (ctx.vals.length !== 1) {
    throw new Error(`expected single value to lower, got [${ctx.vals.length}]`);
  }
  const rem = ctx.storagePtr % 4;
  if (rem !== 0) {
    ctx.storagePtr += 4 - rem;
  }
  _requireValidNumericPrimitive.bind("u32", ctx.vals[0]);
  new DataView(ctx.memory.buffer).setUint32(ctx.storagePtr, ctx.vals[0], true);
  ctx.storagePtr += 4;
}
function _lowerFlatU64(ctx) {
  _debugLog("[_lowerFlatU64()] args", { ctx });
  if (ctx.vals.length !== 1) {
    throw new Error("unexpected number of vals");
  }
  const rem = ctx.storagePtr % 8;
  if (rem !== 0) {
    ctx.storagePtr += 8 - rem;
  }
  _requireValidNumericPrimitive.bind("u64", ctx.vals[0]);
  new DataView(ctx.memory.buffer).setBigUint64(ctx.storagePtr, ctx.vals[0], true);
  ctx.storagePtr += 8;
}
function _lowerFlatStringAny(ctx) {
  switch (ctx.stringEncoding) {
    case "utf8":
      return _lowerFlatStringUTF8(ctx);
    case "utf16":
      return _lowerFlatStringUTF16(ctx);
    default:
      throw new Error(`missing/unrecognized/unsupported string encoding [${ctx.stringEncoding}]`);
  }
}
function _lowerFlatStringUTF8(ctx) {
  _debugLog("[_lowerFlatStringUTF8()] args", ctx);
  if (!ctx.realloc) {
    throw new Error("missing realloc during flat string lower");
  }
  const s = ctx.vals[0];
  const { ptr, codepoints } = _utf8AllocateAndEncode(ctx.vals[0], ctx.realloc, ctx.memory);
  const view = new DataView(ctx.memory.buffer);
  view.setUint32(ctx.storagePtr, ptr, true);
  view.setUint32(ctx.storagePtr + 4, codepoints, true);
  ctx.storagePtr += 8;
}
function _lowerFlatStringUTF16(ctx) {
  _debugLog("[_lowerFlatStringUTF16()] args", { ctx });
  if (!ctx.realloc) {
    throw new Error("missing realloc during flat string lower");
  }
  const s = ctx.vals[0];
  const { ptr, len, codepoints } = _utf16AllocateAndEncode(ctx.vals[0], ctx.realloc, ctx.memory);
  const view = new DataView(ctx.memory.buffer);
  view.setUint32(ctx.storagePtr, ptr, true);
  view.setUint32(ctx.storagePtr + 4, codepoints, true);
  const bytes = new Uint16Array(ctx.memory.buffer, start, codeUnits);
  if (ctx.memory.buffer.byteLength < start + bytes.byteLength) {
    throw new Error("memory out of bounds");
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen !== bytes.byteLength) {
    throw new Error(`storage length [${ctx.storageLen}] != [${bytes.byteLength}])`);
  }
  new Uint16Array(ctx.memory.buffer, ctx.storagePtr).set(bytes);
  ctx.storagePtr += len;
}
function _lowerFlatRecord(meta) {
  const { fieldMetas, size32: recordSize32, align32: recordAlign32 } = meta;
  return function _lowerFlatRecordInner(ctx) {
    _debugLog("[_lowerFlatRecord()] args", { ctx });
    const originalPtr = ctx.storagePtr;
    const r = ctx.vals[0];
    for (const [tag, lowerFn, size32, align32] of fieldMetas) {
      const rem2 = ctx.storagePtr % align32;
      if (rem2 !== 0) {
        ctx.storagePtr += align32 - rem2;
      }
      const fieldPtr = ctx.storagePtr;
      ctx.vals = [r[tag]];
      lowerFn(ctx);
      ctx.storagePtr = Math.max(ctx.storagePtr, fieldPtr + size32);
    }
    ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + recordSize32);
    const rem = ctx.storagePtr % recordAlign32;
    if (rem !== 0) {
      ctx.storagePtr += recordAlign32 - rem;
    }
  };
}
function _lowerFlatVariant(meta) {
  const { variantSize32, variantAlign32, variantPayloadOffset32, caseMetas } = meta;
  let caseLookup = {};
  for (const [idx, meta2] of caseMetas.entries()) {
    let tag = meta2[0];
    caseLookup[tag] = { discriminant: idx, meta: meta2 };
  }
  return function _lowerFlatVariantInner(ctx) {
    _debugLog("[_lowerFlatVariant()] args", { ctx });
    const { tag, val } = ctx.vals[0];
    const variantCase = caseLookup[tag];
    if (!variantCase) {
      throw new Error(`missing tag [${tag}] (valid tags: ${Object.keys(caseLookup)})`);
    }
    const [_tag, lowerFn, caseSize32, caseAlign32, caseFlatCount] = variantCase.meta;
    const originalPtr = ctx.storagePtr;
    ctx.vals = [variantCase.discriminant];
    let discLowerRes;
    if (caseMetas.length < 256) {
      discLowerRes = _lowerFlatU8(ctx);
    } else if (caseMetas.length >= 256 && caseMetas.length < 65536) {
      discLowerRes = _lowerFlatU16(ctx);
    } else if (caseMetas.length >= 65536 && caseMetas.length < 4294967296) {
      discLowerRes = _lowerFlatU32(ctx);
    } else {
      throw new Error(`unsupported number of cases [${caseMetas.length}]`);
    }
    const payloadOffsetPtr = originalPtr + variantPayloadOffset32;
    ctx.storagePtr = payloadOffsetPtr;
    ctx.vals = [val];
    if (lowerFn) {
      lowerFn(ctx);
    }
    ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + variantSize32);
    const rem = ctx.storagePtr % variantAlign32;
    if (rem !== 0) {
      ctx.storagePtr += varianttAlign32 - rem;
    }
  };
}
function _lowerFlatList(meta) {
  const {
    elemLowerFn,
    knownLen,
    size32,
    align32,
    elemSize32,
    elemAlign32
  } = meta;
  if (!elemLowerFn) {
    throw new TypeError("missing/invalid element lower fn for list");
  }
  return function _lowerFlatListInner(ctx) {
    _debugLog("[_lowerFlatList()] args", { ctx });
    if (ctx.useDirectParams) {
      if (ctx.params.length < 2) {
        throw new Error("insufficient params left to lower list");
      }
      const storagePtr = ctx.params[0];
      const elemCount = ctx.params[1];
      ctx.params = ctx.params.slice(2);
      const list = ctx.vals[0];
      if (!list) {
        throw new Error("missing direct param value");
      }
      const lowerCtx = {
        storagePtr,
        memory: ctx.memory,
        stringEncoding: ctx.stringEncoding
      };
      for (let idx = 0; idx < list.length; idx++) {
        const elemPtr = storagePtr + idx * elemSize32;
        lowerCtx.storagePtr = elemPtr;
        lowerCtx.vals = list.slice(idx, idx + 1);
        elemLowerFn(lowerCtx);
        lowerCtx.storagePtr = Math.max(lowerCtx.storagePtr, elemPtr + elemSize32);
      }
      ctx.storagePtr = lowerCtx.storagePtr;
      return;
    }
    const elems = ctx.vals[0];
    if (knownLen === void 0) {
      if (!ctx.realloc) {
        throw new Error("missing realloc during flat string lower");
      }
      const dataPtr = ctx.realloc(0, 0, elemAlign32, elemSize32 * elems.length);
      ctx.vals[0] = dataPtr;
      _lowerFlatU32(ctx);
      ctx.vals[0] = elems.length;
      _lowerFlatU32(ctx);
      const origPtr = ctx.storagePtr;
      ctx.storagePtr = dataPtr;
      for (const [idx, elem] of elems.entries()) {
        const elemPtr = dataPtr + idx * elemSize32;
        ctx.storagePtr = elemPtr;
        ctx.vals = [elem];
        elemLowerFn(ctx);
        ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
      }
      ctx.storagePtr = origPtr;
    } else {
      if (elems.length !== knownLen) {
        throw new TypeError(`invalid list input of length [${elems.length}], must be length [${knownLen}]`);
      }
      const originalPtr = ctx.storagePtr;
      for (const [idx, elem] of elems.entries()) {
        const elemPtr = originalPtr + idx * elemSize32;
        ctx.storagePtr = elemPtr;
        ctx.vals = [elem];
        elemLowerFn(ctx);
        ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
      }
    }
    const totalSizeBytes = elems.length * size32;
    if (ctx.storageLen !== void 0 && totalSizeBytes > ctx.storageLen) {
      throw new Error("not enough storage remaining for list flat lower");
    }
  };
}
function _lowerFlatTuple(meta) {
  const { elemLowerMetas, size32: tupleSize32, align32: tupleAlign32 } = meta;
  return function _lowerFlatTupleInner(ctx) {
    _debugLog("[_lowerFlatTuple()] args", { ctx });
    const originalPtr = ctx.storagePtr;
    const tuple = ctx.vals[0];
    for (const [idx, [lowerFn, size32, align32]] of elemLowerMetas.entries()) {
      const rem2 = ctx.storagePtr % align32;
      if (rem2 !== 0) {
        ctx.storagePtr += align32 - rem2;
      }
      const elemPtr = ctx.storagePtr;
      ctx.vals = [tuple[idx]];
      lowerFn(ctx);
      ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + size32);
    }
    ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + tupleSize32);
    const rem = ctx.storagePtr % tupleAlign32;
    if (rem !== 0) {
      ctx.storagePtr += tupleAlign32 - rem;
    }
  };
}
function _lowerFlatFlags(meta) {
  const { names, size32, align32, intSizeBytes } = meta;
  return function _lowerFlatFlagsInner(ctx) {
    _debugLog("[_lowerFlatFlags()] args", { ctx });
    if (ctx.vals.length !== 1) {
      throw new Error("unexpected number of vals");
    }
    let flagObj = ctx.vals[0];
    let flagValue = 0;
    if (typeof flagObj === "object" && flagObj !== null) {
      for (const [idx, name] of names.entries()) {
        if (flagObj[name] === true) {
          flagValue |= 1 << idx;
        }
      }
    } else if (flagObj !== null && flagObj !== void 0) {
      throw new TypeError("only an object, undefined or null can be converted to flags");
    }
    const rem = ctx.storagePtr % align32;
    if (rem !== 0) {
      ctx.storagePtr += align32 - rem;
    }
    const dv2 = new DataView(ctx.memory.buffer);
    if (intSizeBytes === 1) {
      dv2.setUint8(ctx.storagePtr, flagValue);
    } else if (intSizeBytes === 2) {
      dv2.setUint16(ctx.storagePtr, flagValue);
    } else if (intSizeBytes === 4) {
      dv2.setUint32(ctx.storagePtr, flagValue);
    } else {
      throw new Error(`unrecognized flag size [${intSizeBytes} bytes]`);
    }
    ctx.storagePtr += intSizeBytes;
  };
}
function _lowerFlatEnum(meta) {
  const f = _lowerFlatVariant(meta);
  return function _lowerFlatEnumInner(ctx) {
    _debugLog("[_lowerFlatEnum()] args", { ctx });
    const v = ctx.vals[0];
    const isNotEnumObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v);
    if (isNotEnumObject) {
      ctx.vals[0] = { tag: v };
    }
    f(ctx);
  };
}
function _lowerFlatOption(meta) {
  const f = _lowerFlatVariant(meta);
  return function _lowerFlatOptionInner(ctx) {
    _debugLog("[_lowerFlatOption()] args", { ctx });
    const v = ctx.vals[0];
    if (v === null || v === void 0) {
      ctx.vals[0] = { tag: "none" };
    } else {
      const isNotOptionObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v) || !(v.tag === "some" || v.tag === "none") || !("val" in v);
      if (isNotOptionObject) {
        ctx.vals[0] = { tag: "some", val: v };
      }
    }
    f(ctx);
  };
}
function _lowerFlatResult(meta) {
  const f = _lowerFlatVariant(meta);
  return function _lowerFlatResultInner(ctx) {
    _debugLog("[_lowerFlatResult()] args", { ctx });
    const v = ctx.vals[0];
    const isNotResultObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v) || !("ok" === v.tag || "err" === v.tag) || !("val" in v);
    if (isNotResultObject) {
      ctx.vals[0] = { tag: "ok", val: v };
    }
    f(ctx);
  };
}
function _lowerFlatOwn(meta) {
  const { lowerFn, componentIdx: componentIdx2 } = meta;
  return function _lowerFlatOwnInner(ctx) {
    _debugLog("[_lowerFlatOwn()] args", { ctx });
    const { createFn } = ctx;
    if (ctx.componentIdx !== componentIdx2) {
      throw new Error(`component index mismatch (expected [${componentIdx2}], lift called from [${ctx.componentIdx}])`);
    }
    const obj = ctx.vals[0];
    if (obj === void 0 || obj === null) {
      throw new Error("missing resource");
    }
    const handle = lowerFn(obj);
    ctx.vals[0] = handle;
    _lowerFlatU32(ctx);
  };
}
var STREAMS = new RepTable({ target: "global stream map" });
var ASYNC_STATE = /* @__PURE__ */ new Map();
function getOrCreateAsyncState(componentIdx2, init) {
  if (!ASYNC_STATE.has(componentIdx2)) {
    const newState = new ComponentAsyncState({ componentIdx: componentIdx2 });
    ASYNC_STATE.set(componentIdx2, newState);
  }
  return ASYNC_STATE.get(componentIdx2);
}
var ComponentAsyncState = class _ComponentAsyncState {
  static EVENT_HANDLER_EVENTS = ["backpressure-change"];
  #componentIdx;
  #callingAsyncImport = false;
  #syncImportWait = promiseWithResolvers();
  #locked = false;
  #parkedTasks = /* @__PURE__ */ new Map();
  #suspendedTasksByTaskID = /* @__PURE__ */ new Map();
  #suspendedTaskIDs = [];
  #errored = null;
  #backpressure = 0;
  #backpressureWaiters = 0n;
  #handlerMap = /* @__PURE__ */ new Map();
  #nextHandlerID = 0n;
  #tickLoop = null;
  #tickLoopInterval = null;
  #onExclusiveReleaseHandlers = [];
  mayLeave = true;
  handles;
  subtasks;
  constructor(args) {
    this.#componentIdx = args.componentIdx;
    this.handles = new RepTable({ target: `component [${this.#componentIdx}] handles (waitable objects)` });
    this.subtasks = new RepTable({ target: `component [${this.#componentIdx}] subtasks` });
  }
  componentIdx() {
    return this.#componentIdx;
  }
  errored() {
    return this.#errored !== null;
  }
  setErrored(err) {
    _debugLog("[ComponentAsyncState#setErrored()] component errored", { err, componentIdx: this.#componentIdx });
    if (this.#errored) {
      return;
    }
    if (!err) {
      err = new Error("error elswehere (see other component instance error)");
      err.componentIdx = this.#componentIdx;
    }
    this.#errored = err;
  }
  callingSyncImport(val) {
    if (val === void 0) {
      return this.#callingAsyncImport;
    }
    if (typeof val !== "boolean") {
      throw new TypeError("invalid setting for async import");
    }
    const prev = this.#callingAsyncImport;
    this.#callingAsyncImport = val;
    if (prev === true && this.#callingAsyncImport === false) {
      this.#notifySyncImportEnd();
    }
  }
  #notifySyncImportEnd() {
    const existing = this.#syncImportWait;
    this.#syncImportWait = promiseWithResolvers();
    existing.resolve();
  }
  async waitForSyncImportCallEnd() {
    await this.#syncImportWait.promise;
  }
  setBackpressure(v) {
    this.#backpressure = v;
    return this.#backpressure;
  }
  getBackpressure() {
    return this.#backpressure;
  }
  incrementBackpressure() {
    const current = this.#backpressure;
    if (current < 0 || current > 2 ** 16) {
      throw new Error(`invalid current backpressure value [${current}]`);
    }
    const newValue = this.getBackpressure() + 1;
    if (newValue >= 2 ** 16) {
      throw new Error(`invalid new backpressure value [${newValue}], overflow`);
    }
    return this.setBackpressure(newValue);
  }
  decrementBackpressure() {
    const current = this.#backpressure;
    if (current < 0 || current > 2 ** 16) {
      throw new Error(`invalid current backpressure value [${current}]`);
    }
    const newValue = Math.max(0, current - 1);
    if (newValue < 0) {
      throw new Error(`invalid new backpressure value [${newValue}], underflow`);
    }
    return this.setBackpressure(newValue);
  }
  hasBackpressure() {
    return this.#backpressure > 0;
  }
  waitForBackpressure() {
    let backpressureCleared = false;
    const cstate = this;
    cstate.addBackpressureWaiter();
    const handlerID = this.registerHandler({
      event: "backpressure-change",
      fn: (bp) => {
        if (bp === 0) {
          cstate.removeHandler(handlerID);
          backpressureCleared = true;
        }
      }
    });
    return new Promise((resolve2) => {
      const interval = setInterval(() => {
        if (backpressureCleared) {
          return;
        }
        clearInterval(interval);
        cstate.removeBackpressureWaiter();
        resolve2(null);
      }, 0);
    });
  }
  registerHandler(args) {
    const { event, fn } = args;
    if (!event) {
      throw new Error("missing handler event");
    }
    if (!fn) {
      throw new Error("missing handler fn");
    }
    if (!_ComponentAsyncState.EVENT_HANDLER_EVENTS.includes(event)) {
      throw new Error(`unrecognized event handler [${event}]`);
    }
    const handlerID = this.#nextHandlerID++;
    let handlers = this.#handlerMap.get(event);
    if (!handlers) {
      handlers = [];
      this.#handlerMap.set(event, handlers);
    }
    handlers.push({ id: handlerID, fn, event });
    return handlerID;
  }
  removeHandler(args) {
    const { event, handlerID } = args;
    const registeredHandlers = this.#handlerMap.get(event);
    if (!registeredHandlers) {
      return;
    }
    const found = registeredHandlers.find((h) => h.id === handlerID);
    if (!found) {
      return;
    }
    this.#handlerMap.set(event, this.#handlerMap.get(event).filter((h) => h.id !== handlerID));
  }
  getBackpressureWaiters() {
    return this.#backpressureWaiters;
  }
  addBackpressureWaiter() {
    this.#backpressureWaiters++;
  }
  removeBackpressureWaiter() {
    this.#backpressureWaiters--;
    if (this.#backpressureWaiters < 0) {
      throw new Error("unexepctedly negative number of backpressure waiters");
    }
  }
  isExclusivelyLocked() {
    return this.#locked === true;
  }
  setLocked(locked) {
    this.#locked = locked;
  }
  exclusiveLock() {
    _debugLog("[ComponentAsyncState#exclusiveLock()]", {
      locked: this.#locked,
      componentIdx: this.#componentIdx
    });
    this.setLocked(true);
  }
  exclusiveRelease() {
    _debugLog("[ComponentAsyncState#exclusiveRelease()] args", {
      locked: this.#locked,
      componentIdx: this.#componentIdx
    });
    this.setLocked(false);
    this.#onExclusiveReleaseHandlers = this.#onExclusiveReleaseHandlers.filter((v) => !!v);
    for (const [idx, f] of this.#onExclusiveReleaseHandlers.entries()) {
      try {
        this.#onExclusiveReleaseHandlers[idx] = null;
        f();
      } catch (err) {
        _debugLog("error while executing handler for next exclusive release", err);
        throw err;
      }
    }
  }
  onNextExclusiveRelease(fn) {
    _debugLog("[ComponentAsyncState#()onNextExclusiveRelease] registering");
    this.#onExclusiveReleaseHandlers.push(fn);
  }
  // nextTaskPromise & nextTaskQueue are used to await current task completion and queues
  // any tasks attempting to enter() and complete.
  //
  // see: nextTaskExecutionSlot()
  //
  // TODO(threads): this should be unnecessary once threads are properly implemented,
  // as the task.enter() logic should suffice (it should be guaranteed that we cannot re-enter
  // unless the task in question is the current task in the thread execution, and only one can
  // run at a time)
  #nextTaskPromise = Promise.resolve(true);
  #nextTaskQueue = [];
  async nextTaskExecutionSlot(args) {
    const { task } = args;
    const placeholder = {
      completed: false,
      task,
      promise: task.exitPromise().then(() => {
        placeholder.completed = true;
      })
    };
    this.#nextTaskQueue.push(placeholder);
    let next;
    while (true) {
      await this.#nextTaskPromise;
      next = this.#nextTaskQueue.find((placeholder2) => !placeholder2.completed);
      if (next === void 0 || next === placeholder) {
        this.#nextTaskPromise = next.promise;
        if (this.#nextTaskQueue.length > 1e3) {
          this.#nextTaskQueue = this.#nextTaskQueue.filter((p) => !p.completed);
          if (this.#nextTaskQueue.length > 1e3) {
            _debugLog("[ComponentAsyncState#()nextTaskExecutionSlot] next task queue length > 1000 even after cleanup, tasks may be leaking");
          }
        }
        break;
      }
    }
  }
  #getSuspendedTaskMeta(taskID) {
    return this.#suspendedTasksByTaskID.get(taskID);
  }
  #removeSuspendedTaskMeta(taskID) {
    _debugLog("[ComponentAsyncState#removeSuspendedTaskMeta()] removing suspended task", {
      taskID,
      componentIdx: this.#componentIdx
    });
    const idx = this.#suspendedTaskIDs.findIndex((t) => t === taskID);
    const meta = this.#suspendedTasksByTaskID.get(taskID);
    this.#suspendedTaskIDs[idx] = null;
    this.#suspendedTasksByTaskID.delete(taskID);
    return meta;
  }
  #addSuspendedTaskMeta(meta) {
    if (!meta) {
      throw new Error("missing task meta");
    }
    const taskID = meta.taskID;
    this.#suspendedTasksByTaskID.set(taskID, meta);
    this.#suspendedTaskIDs.push(taskID);
    if (this.#suspendedTasksByTaskID.size < this.#suspendedTaskIDs.length - 10) {
      this.#suspendedTaskIDs = this.#suspendedTaskIDs.filter((t) => t !== null);
    }
  }
  // TODO(threads): readyFn is normally on the thread
  suspendTask(args) {
    const { task, readyFn } = args;
    const taskID = task.id();
    const componentIdx2 = task.componentIdx();
    _debugLog("[ComponentAsyncState#suspendTask()]", {
      taskID,
      componentIdx: this.#componentIdx,
      taskEntryFnName: task.entryFnName(),
      subtask: task.getParentSubtask()
    });
    if (componentIdx2 !== this.#componentIdx) {
      throw new Error("assert: task component idx should match async state");
    }
    if (this.#getSuspendedTaskMeta(taskID)) {
      throw new Error(`task [${taskID}] already suspended`);
    }
    const { promise, resolve: resolve2, reject: reject2 } = promiseWithResolvers();
    this.#addSuspendedTaskMeta({
      task,
      taskID,
      readyFn,
      resume: () => {
        _debugLog("[ComponentAsyncState] resuming suspended task", {
          taskID,
          componentIdx: this.#componentIdx
        });
        resolve2(!task.isCancelled());
      }
    });
    this.runTickLoop();
    return promise;
  }
  resumeTaskByID(taskID) {
    const meta = this.#removeSuspendedTaskMeta(taskID);
    if (!meta) {
      return;
    }
    if (meta.taskID !== taskID) {
      throw new Error("task ID does not match");
    }
    meta.resume();
  }
  async runTickLoop() {
    if (this.#tickLoop !== null) {
      return;
    }
    this.#tickLoop = 1;
    setTimeout(async () => {
      let done = this.tick();
      while (!done) {
        await new Promise((resolve2) => setTimeout(resolve2, 30));
        done = this.tick();
      }
      this.#tickLoop = null;
    }, 10);
  }
  tick() {
    const resumableTasks = this.#suspendedTaskIDs.filter((t) => t !== null);
    for (const taskID of resumableTasks) {
      const meta = this.#suspendedTasksByTaskID.get(taskID);
      if (!meta || !meta.readyFn) {
        throw new Error(`missing/invalid task despite ID [${taskID}] being present`);
      }
      if (meta.task.isRejected()) {
        _debugLog("[ComponentAsyncState#tick()] detected task rejection, leaving early", { meta });
        this.resumeTaskByID(taskID);
        return;
      }
      const isReady = meta.readyFn();
      if (!isReady) {
        continue;
      }
      _debugLog("[ComponentAsyncState#tick()] resuming task via tick", {
        taskID,
        componentIdx: this.#componentIdx
      });
      this.resumeTaskByID(taskID);
    }
    return this.#suspendedTaskIDs.filter((t) => t !== null).length === 0;
  }
  addStreamEndToTable(args) {
    _debugLog("[ComponentAsyncState#addStreamEnd()] args", args);
    const { tableIdx, streamEnd } = args;
    if (typeof streamEnd === "number") {
      throw new Error("INSERTING BAD STREAMEND");
    }
    let { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    if (componentIdx2 === void 0 || !table) {
      throw new Error(`invalid global stream table state for table [${tableIdx}]`);
    }
    const handle = table.insert(streamEnd);
    streamEnd.setHandle(handle);
    streamEnd.setStreamTableIdx(tableIdx);
    const cstate = getOrCreateAsyncState(componentIdx2);
    const waitableIdx = cstate.handles.insert(streamEnd);
    streamEnd.setWaitableIdx(waitableIdx);
    _debugLog("[ComponentAsyncState#addStreamEnd()] added stream end", {
      tableIdx,
      table,
      handle,
      streamEnd,
      destComponentIdx: componentIdx2
    });
    return { handle, waitableIdx };
  }
  createWaitable(args) {
    return new Waitable({ target: args?.target });
  }
  createReadableStreamEnd(args) {
    _debugLog("[ComponentAsyncState#createStreamEnd()] args", args);
    const { tableIdx, elemMeta, hostInjectFn } = args;
    const { table: localStreamTable, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    if (!localStreamTable) {
      throw new Error(`missing global stream table lookup for table [${tableIdx}] while creating stream`);
    }
    if (componentIdx2 !== this.#componentIdx) {
      throw new Error("component idx mismatch while creating stream");
    }
    const waitable = this.createWaitable();
    const streamEnd = new StreamReadableEnd({
      tableIdx,
      elemMeta,
      hostInjectFn,
      pendingBufferMeta: {},
      target: `stream read end (lowered, @init)`,
      waitable
    });
    streamEnd.setWaitableIdx(this.handles.insert(streamEnd));
    streamEnd.setHandle(localStreamTable.insert(streamEnd));
    if (streamEnd.streamTableIdx() !== tableIdx) {
      throw new Error("unexpectedly mismatched stream table");
    }
    const streamEndWaitableIdx = streamEnd.waitableIdx();
    const streamEndHandle = streamEnd.handle();
    waitable.setTarget(`waitable for stream read end (lowered, waitable [${streamEndWaitableIdx}])`);
    streamEnd.setTarget(`stream read end (lowered, waitable [${streamEndWaitableIdx}])`);
    return {
      waitableIdx: streamEndWaitableIdx,
      handle: streamEndHandle,
      streamEnd
    };
  }
  createStream(args) {
    _debugLog("[ComponentAsyncState#createStream()] args", args);
    const { tableIdx, elemMeta, hostInjectFn } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while adding stream");
    }
    if (elemMeta === void 0) {
      throw new Error("missing element metadata while adding stream");
    }
    const { table: localStreamTable, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    if (!localStreamTable) {
      throw new Error(`missing global stream table lookup for table [${tableIdx}] while creating stream`);
    }
    if (componentIdx2 !== this.#componentIdx) {
      throw new Error("component idx mismatch while creating stream");
    }
    const readWaitable = this.createWaitable();
    const writeWaitable = this.createWaitable();
    const stream = new InternalStream({
      tableIdx,
      elemMeta,
      readWaitable,
      writeWaitable,
      hostInjectFn
    });
    stream.setGlobalStreamMapRep(STREAMS.insert(stream));
    const writeEnd = stream.writeEnd();
    writeEnd.setWaitableIdx(this.handles.insert(writeEnd));
    writeEnd.setHandle(localStreamTable.insert(writeEnd));
    if (writeEnd.streamTableIdx() !== tableIdx) {
      throw new Error("unexpectedly mismatched stream table");
    }
    const writeEndWaitableIdx = writeEnd.waitableIdx();
    const writeEndHandle = writeEnd.handle();
    writeWaitable.setTarget(`waitable for stream write end (waitable [${writeEndWaitableIdx}])`);
    writeEnd.setTarget(`stream write end (waitable [${writeEndWaitableIdx}])`);
    const readEnd = stream.readEnd();
    readEnd.setWaitableIdx(this.handles.insert(readEnd));
    readEnd.setHandle(localStreamTable.insert(readEnd));
    if (readEnd.streamTableIdx() !== tableIdx) {
      throw new Error("unexpectedly mismatched stream table");
    }
    const readEndWaitableIdx = readEnd.waitableIdx();
    const readEndHandle = readEnd.handle();
    readWaitable.setTarget(`waitable for read end (waitable [${readEndWaitableIdx}])`);
    readEnd.setTarget(`stream read end (waitable [${readEndWaitableIdx}])`);
    return {
      writeEnd,
      writeEndWaitableIdx,
      writeEndHandle,
      readEndWaitableIdx,
      readEndHandle,
      readEnd
    };
  }
  getStreamEnd(args) {
    _debugLog("[ComponentAsyncState#getStreamEnd()] args", args);
    const { tableIdx, streamEndHandle, streamEndWaitableIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while getting stream end");
    }
    const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    const cstate = getOrCreateAsyncState(componentIdx2);
    let streamEnd;
    if (streamEndWaitableIdx !== void 0) {
      streamEnd = cstate.handles.get(streamEndWaitableIdx);
    } else if (streamEndHandle !== void 0) {
      if (!table) {
        throw new Error(`missing/invalid table [${tableIdx}] while getting stream end`);
      }
      streamEnd = table.get(streamEndHandle);
    } else {
      throw new TypeError("must specify either waitable idx or handle to retrieve stream");
    }
    if (!streamEnd) {
      throw new Error(`missing stream end (tableIdx [${tableIdx}], handle [${streamEndHandle}], waitableIdx [${streamEndWaitableIdx}])`);
    }
    if (tableIdx && streamEnd.streamTableIdx() !== tableIdx) {
      throw new Error(`stream end table idx [${streamEnd.streamTableIdx()}] does not match [${tableIdx}]`);
    }
    return streamEnd;
  }
  deleteStreamEnd(args) {
    _debugLog("[ComponentAsyncState#deleteStreamEnd()] args", args);
    const { tableIdx, streamEndWaitableIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while removing stream end");
    }
    if (streamEndWaitableIdx === void 0) {
      throw new Error("missing stream idx while removing stream end");
    }
    const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    const cstate = getOrCreateAsyncState(componentIdx2);
    const streamEnd = cstate.handles.get(streamEndWaitableIdx);
    if (!streamEnd) {
      throw new Error(`missing stream end [${streamEndWaitableIdx}] in component handles while deleting stream`);
    }
    if (streamEnd.streamTableIdx() !== tableIdx) {
      throw new Error(`stream end table idx [${streamEnd.streamTableIdx()}] does not match [${tableIdx}]`);
    }
    let removed = cstate.handles.remove(streamEnd.waitableIdx());
    if (!removed) {
      throw new Error(`failed to remove stream end [${streamEndWaitableIdx}] waitable obj in component [${componentIdx2}]`);
    }
    removed = table.remove(streamEnd.handle());
    if (!removed) {
      throw new Error(`failed to remove stream end with handle [${streamEnd.handle()}] from stream table [${tableIdx}] in component [${componentIdx2}]`);
    }
    return streamEnd;
  }
  removeStreamEndFromTable(args) {
    _debugLog("[ComponentAsyncState#removeStreamEndFromTable()] args", args);
    const { tableIdx, streamWaitableIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while removing stream end");
    }
    if (streamWaitableIdx === void 0) {
      throw new Error("missing stream end waitable idx while removing stream end");
    }
    const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
    if (!table) {
      throw new Error(`missing/invalid table [${tableIdx}] while removing stream end`);
    }
    const cstate = getOrCreateAsyncState(componentIdx2);
    const streamEnd = cstate.handles.get(streamWaitableIdx);
    if (!streamEnd) {
      throw new Error(`missing stream end (handle [${streamWaitableIdx}], table [${tableIdx}])`);
    }
    const handle = streamEnd.handle();
    let removed = cstate.handles.remove(streamWaitableIdx);
    if (!removed) {
      throw new Error(`failed to remove streamEnd from handles (waitable idx [${streamWaitableIdx}]), component [${componentIdx2}])`);
    }
    removed = table.remove(handle);
    if (!removed) {
      throw new Error(`failed to remove streamEnd from table (handle [${handle}]), table [${tableIdx}], component [${componentIdx2}])`);
    }
    return streamEnd;
  }
  createFuture(args) {
    _debugLog("[ComponentAsyncState#createFuture()] args", args);
    const { tableIdx, elemMeta, hostInjectFn } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while adding future");
    }
    if (elemMeta === void 0) {
      throw new Error("missing element metadata while adding future");
    }
    const { table: futureTable, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
    if (!futureTable) {
      throw new Error(`missing global future table lookup for table [${tableIdx}] while creating future`);
    }
    if (componentIdx2 !== this.#componentIdx) {
      throw new Error("component idx mismatch while creating future");
    }
    const readWaitable = this.createWaitable();
    const writeWaitable = this.createWaitable();
    const future = new InternalFuture({
      tableIdx,
      componentIdx: this.#componentIdx,
      elemMeta,
      readWaitable,
      writeWaitable,
      hostInjectFn
    });
    future.setGlobalFutureMapRep(FUTURES.insert(future));
    const writeEnd = future.writeEnd();
    writeEnd.setWaitableIdx(this.handles.insert(writeEnd));
    writeEnd.setHandle(futureTable.insert(writeEnd));
    if (writeEnd.futureTableIdx() !== tableIdx) {
      throw new Error("unexpectedly mismatched future table");
    }
    const writeEndWaitableIdx = writeEnd.waitableIdx();
    const writeEndHandle = writeEnd.handle();
    writeWaitable.setTarget(`waitable for future write end (waitable [${writeEndWaitableIdx}])`);
    writeEnd.setTarget(`future write end (waitable [${writeEndWaitableIdx}])`);
    const readEnd = future.readEnd();
    readEnd.setWaitableIdx(this.handles.insert(readEnd));
    readEnd.setHandle(futureTable.insert(readEnd));
    if (readEnd.futureTableIdx() !== tableIdx) {
      throw new Error("unexpectedly mismatched future table");
    }
    const readEndWaitableIdx = readEnd.waitableIdx();
    const readEndHandle = readEnd.handle();
    readWaitable.setTarget(`waitable for read end (waitable [${readEndWaitableIdx}])`);
    readEnd.setTarget(`future read end (waitable [${readEndWaitableIdx}])`);
    return {
      writeEnd,
      writeEndWaitableIdx,
      writeEndHandle,
      readEndWaitableIdx,
      readEndHandle,
      readEnd
    };
  }
  getFutureEnd(args) {
    _debugLog("[ComponentAsyncState#getFutureEnd()] args", args);
    const { tableIdx, futureEndHandle, futureEndWaitableIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while getting future end");
    }
    const { table, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
    const cstate = getOrCreateAsyncState(componentIdx2);
    let futureEnd;
    if (futureEndWaitableIdx !== void 0) {
      futureEnd = cstate.handles.get(futureEndWaitableIdx);
    } else if (futureEndHandle !== void 0) {
      if (!table) {
        throw new Error(`missing/invalid table [${tableIdx}] while getting future end`);
      }
      futureEnd = table.get(futureEndHandle);
    } else {
      throw new TypeError("must specify either waitable idx or handle to retrieve future");
    }
    if (!futureEnd) {
      throw new Error(`missing future end (tableIdx [${tableIdx}], handle [${futureEndHandle}], waitableIdx [${futureEndWaitableIdx}])`);
    }
    if (tableIdx && futureEnd.futureTableIdx() !== tableIdx) {
      throw new Error(`future end table idx [${futureEnd.futureTableIdx()}] does not match [${tableIdx}]`);
    }
    return futureEnd;
  }
  removeFutureEndFromTable(args) {
    _debugLog("[ComponentAsyncState#removeFutureEndFromTable()] args", args);
    const { tableIdx, futureWaitableIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while removing future end");
    }
    if (futureWaitableIdx === void 0) {
      throw new Error("missing future end waitable idx while removing future end");
    }
    const { table, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
    if (!table) {
      throw new Error(`missing/invalid table [${tableIdx}] while removing future end`);
    }
    const cstate = getOrCreateAsyncState(componentIdx2);
    const futureEnd = cstate.handles.get(futureWaitableIdx);
    if (!futureEnd) {
      throw new Error(`missing future end (handle [${futureWaitableIdx}], table [${tableIdx}])`);
    }
    const handle = futureEnd.handle();
    let removed = cstate.handles.remove(futureWaitableIdx);
    if (!removed) {
      throw new Error(`failed to remove futureEnd from handles (waitable idx [${futureWaitableIdx}]), component [${componentIdx2}])`);
    }
    removed = table.remove(handle);
    if (!removed) {
      throw new Error(`failed to remove futureEnd from table (handle [${handle}]), table [${tableIdx}], component [${componentIdx2}])`);
    }
    return futureEnd;
  }
};
var base64Compile = (str) => WebAssembly.compile(
  typeof Buffer !== "undefined" ? Buffer.from(str, "base64") : Uint8Array.from(atob(str), (b) => b.charCodeAt(0))
);
var isNode = typeof process !== "undefined" && process.versions && process.versions.node;
var _fs;
async function fetchCompile(url) {
  if (isNode) {
    _fs = _fs || await import("node:fs/promises");
    return WebAssembly.compile(await _fs.readFile(url));
  }
  return fetch(url).then(WebAssembly.compileStreaming);
}
var symbolCabiDispose = Symbol.for("cabiDispose");
var symbolRscHandle = Symbol("handle");
var symbolRscRep = Symbol.for("cabiRep");
var HANDLE_TABLES = [];
var ComponentError = class extends Error {
  constructor(value) {
    const enumerable = typeof value !== "string";
    super(enumerable ? `${String(value)} (see error.payload)` : value);
    Object.defineProperty(this, "payload", { value, enumerable });
  }
};
function getErrorPayload(e) {
  if (e && hasOwnProperty.call(e, "payload")) return e.payload;
  if (e instanceof Error) throw e;
  return e;
}
var isLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
function throwUninitialized() {
  throw new TypeError("Wasm uninitialized use `await $init` first");
}
var hasOwnProperty = Object.prototype.hasOwnProperty;
var instantiateCore = WebAssembly.instantiate;
var exports0;
var exports1;
var handleTable2 = [T_FLAG, 0];
handleTable2._createdReps = /* @__PURE__ */ new Set();
var captureTable2 = /* @__PURE__ */ new Map();
var captureCnt2 = 0;
HANDLE_TABLES[2] = handleTable2;
var _trampoline5 = function() {
  _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getStderr",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getStderr()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  if (!(ret instanceof OutputStream2)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep2);
  }
  _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"][Instruction::Return]', {
    funcName: "get-stderr",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  task.resolve([handle0]);
  task.exit();
  return handle0;
};
_trampoline5.fnName = "wasi:cli/stderr@0.2.3#getStderr";
var handleTable1 = [T_FLAG, 0];
handleTable1._createdReps = /* @__PURE__ */ new Set();
var captureTable1 = /* @__PURE__ */ new Map();
var captureCnt1 = 0;
HANDLE_TABLES[1] = handleTable1;
var _trampoline8 = function() {
  _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getStdin",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getStdin()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  if (!(ret instanceof InputStream2)) {
    throw new TypeError('Resource error: Not a valid "InputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt1;
    captureTable1.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable1, rep2);
  }
  _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"][Instruction::Return]', {
    funcName: "get-stdin",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  task.resolve([handle0]);
  task.exit();
  return handle0;
};
_trampoline8.fnName = "wasi:cli/stdin@0.2.3#getStdin";
var _trampoline9 = function() {
  _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getStdout",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getStdout()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  if (!(ret instanceof OutputStream2)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep2);
  }
  _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"][Instruction::Return]', {
    funcName: "get-stdout",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  task.resolve([handle0]);
  task.exit();
  return handle0;
};
_trampoline9.fnName = "wasi:cli/stdout@0.2.3#getStdout";
var _trampoline10 = function(arg0) {
  let variant0;
  switch (arg0) {
    case 0: {
      variant0 = {
        tag: "ok",
        val: void 0
      };
      break;
    }
    case 1: {
      variant0 = {
        tag: "err",
        val: void 0
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "exit",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => exit2(variant0)
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"][Instruction::Return]', {
    funcName: "exit",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline10.fnName = "wasi:cli/exit@0.2.3#exit";
var exports2;
var memory0;
var realloc0;
var realloc0Async;
var _trampoline11 = function(arg0) {
  _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getEnvironment",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getEnvironment()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 16);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 16;
    var [tuple0_0, tuple0_1] = e;
    var encodeRes = _utf8AllocateAndEncode(tuple0_0, realloc0, memory0);
    var ptr1 = encodeRes.ptr;
    var len1 = encodeRes.len;
    dataView(memory0).setUint32(base + 4, len1, true);
    dataView(memory0).setUint32(base + 0, ptr1, true);
    var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
    var ptr2 = encodeRes.ptr;
    var len2 = encodeRes.len;
    dataView(memory0).setUint32(base + 12, len2, true);
    dataView(memory0).setUint32(base + 8, ptr2, true);
  }
  dataView(memory0).setUint32(arg0 + 4, len3, true);
  dataView(memory0).setUint32(arg0 + 0, result3, true);
  _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"][Instruction::Return]', {
    funcName: "get-environment",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline11.fnName = "wasi:cli/environment@0.2.3#getEnvironment";
var handleTable6 = [T_FLAG, 0];
handleTable6._createdReps = /* @__PURE__ */ new Set();
var captureTable6 = /* @__PURE__ */ new Map();
var captureCnt6 = 0;
HANDLE_TABLES[6] = handleTable6;
var _trampoline12 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-flags"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getFlags",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.getFlags()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      let flags3 = 0;
      if (typeof e === "object" && e !== null) {
        flags3 = Boolean(e.read) << 0 | Boolean(e.write) << 1 | Boolean(e.fileIntegritySync) << 2 | Boolean(e.dataIntegritySync) << 3 | Boolean(e.requestedWriteSync) << 4 | Boolean(e.mutateDirectory) << 5;
      } else if (e !== null && e !== void 0) {
        throw new TypeError("only an object, undefined or null can be converted to flags");
      }
      dataView(memory0).setInt8(arg1 + 1, flags3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-flags"][Instruction::Return]', {
    funcName: "[method]descriptor.get-flags",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline12.fnName = "wasi:filesystem/types@0.2.3#getFlags";
var _trampoline13 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getType",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.getType()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "unknown": {
          enum3 = 0;
          break;
        }
        case "block-device": {
          enum3 = 1;
          break;
        }
        case "character-device": {
          enum3 = 2;
          break;
        }
        case "directory": {
          enum3 = 3;
          break;
        }
        case "fifo": {
          enum3 = 4;
          break;
        }
        case "symbolic-link": {
          enum3 = 5;
          break;
        }
        case "regular-file": {
          enum3 = 6;
          break;
        }
        case "socket": {
          enum3 = 7;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"][Instruction::Return]', {
    funcName: "[method]descriptor.get-type",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline13.fnName = "wasi:filesystem/types@0.2.3#getType";
var _trampoline14 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "metadataHash",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.metadataHash()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { lower: v3_0, upper: v3_1 } = e;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v3_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"][Instruction::Return]', {
    funcName: "[method]descriptor.metadata-hash",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline14.fnName = "wasi:filesystem/types@0.2.3#metadataHash";
var handleTable0 = [T_FLAG, 0];
handleTable0._createdReps = /* @__PURE__ */ new Set();
var captureTable0 = /* @__PURE__ */ new Map();
var captureCnt0 = 0;
HANDLE_TABLES[0] = handleTable0;
var _trampoline15 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable0.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Error$1.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "filesystemErrorCode",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => filesystemErrorCode(rsc0)
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant4 = ret;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(arg1 + 0, 0, true);
  } else {
    const e = variant4;
    dataView(memory0).setInt8(arg1 + 0, 1, true);
    var val3 = e;
    let enum3;
    switch (val3) {
      case "access": {
        enum3 = 0;
        break;
      }
      case "would-block": {
        enum3 = 1;
        break;
      }
      case "already": {
        enum3 = 2;
        break;
      }
      case "bad-descriptor": {
        enum3 = 3;
        break;
      }
      case "busy": {
        enum3 = 4;
        break;
      }
      case "deadlock": {
        enum3 = 5;
        break;
      }
      case "quota": {
        enum3 = 6;
        break;
      }
      case "exist": {
        enum3 = 7;
        break;
      }
      case "file-too-large": {
        enum3 = 8;
        break;
      }
      case "illegal-byte-sequence": {
        enum3 = 9;
        break;
      }
      case "in-progress": {
        enum3 = 10;
        break;
      }
      case "interrupted": {
        enum3 = 11;
        break;
      }
      case "invalid": {
        enum3 = 12;
        break;
      }
      case "io": {
        enum3 = 13;
        break;
      }
      case "is-directory": {
        enum3 = 14;
        break;
      }
      case "loop": {
        enum3 = 15;
        break;
      }
      case "too-many-links": {
        enum3 = 16;
        break;
      }
      case "message-size": {
        enum3 = 17;
        break;
      }
      case "name-too-long": {
        enum3 = 18;
        break;
      }
      case "no-device": {
        enum3 = 19;
        break;
      }
      case "no-entry": {
        enum3 = 20;
        break;
      }
      case "no-lock": {
        enum3 = 21;
        break;
      }
      case "insufficient-memory": {
        enum3 = 22;
        break;
      }
      case "insufficient-space": {
        enum3 = 23;
        break;
      }
      case "not-directory": {
        enum3 = 24;
        break;
      }
      case "not-empty": {
        enum3 = 25;
        break;
      }
      case "not-recoverable": {
        enum3 = 26;
        break;
      }
      case "unsupported": {
        enum3 = 27;
        break;
      }
      case "no-tty": {
        enum3 = 28;
        break;
      }
      case "no-such-device": {
        enum3 = 29;
        break;
      }
      case "overflow": {
        enum3 = 30;
        break;
      }
      case "not-permitted": {
        enum3 = 31;
        break;
      }
      case "pipe": {
        enum3 = 32;
        break;
      }
      case "read-only": {
        enum3 = 33;
        break;
      }
      case "invalid-seek": {
        enum3 = 34;
        break;
      }
      case "text-file-busy": {
        enum3 = 35;
        break;
      }
      case "cross-device": {
        enum3 = 36;
        break;
      }
      default: {
        if (e instanceof Error) {
          console.error(e);
        }
        throw new TypeError(`"${val3}" is not one of the cases of error-code`);
      }
    }
    dataView(memory0).setInt8(arg1 + 1, enum3, true);
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"][Instruction::Return]', {
    funcName: "filesystem-error-code",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline15.fnName = "wasi:filesystem/types@0.2.3#filesystemErrorCode";
var _trampoline16 = function(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "metadataHashAt",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.metadataHashAt(flags3, result4)
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant7 = ret;
  switch (variant7.tag) {
    case "ok": {
      const e = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { lower: v5_0, upper: v5_1 } = e;
      dataView(memory0).setBigInt64(arg4 + 8, toUint64(v5_0), true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      break;
    }
    case "err": {
      const e = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val6 = e;
      let enum6;
      switch (val6) {
        case "access": {
          enum6 = 0;
          break;
        }
        case "would-block": {
          enum6 = 1;
          break;
        }
        case "already": {
          enum6 = 2;
          break;
        }
        case "bad-descriptor": {
          enum6 = 3;
          break;
        }
        case "busy": {
          enum6 = 4;
          break;
        }
        case "deadlock": {
          enum6 = 5;
          break;
        }
        case "quota": {
          enum6 = 6;
          break;
        }
        case "exist": {
          enum6 = 7;
          break;
        }
        case "file-too-large": {
          enum6 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum6 = 9;
          break;
        }
        case "in-progress": {
          enum6 = 10;
          break;
        }
        case "interrupted": {
          enum6 = 11;
          break;
        }
        case "invalid": {
          enum6 = 12;
          break;
        }
        case "io": {
          enum6 = 13;
          break;
        }
        case "is-directory": {
          enum6 = 14;
          break;
        }
        case "loop": {
          enum6 = 15;
          break;
        }
        case "too-many-links": {
          enum6 = 16;
          break;
        }
        case "message-size": {
          enum6 = 17;
          break;
        }
        case "name-too-long": {
          enum6 = 18;
          break;
        }
        case "no-device": {
          enum6 = 19;
          break;
        }
        case "no-entry": {
          enum6 = 20;
          break;
        }
        case "no-lock": {
          enum6 = 21;
          break;
        }
        case "insufficient-memory": {
          enum6 = 22;
          break;
        }
        case "insufficient-space": {
          enum6 = 23;
          break;
        }
        case "not-directory": {
          enum6 = 24;
          break;
        }
        case "not-empty": {
          enum6 = 25;
          break;
        }
        case "not-recoverable": {
          enum6 = 26;
          break;
        }
        case "unsupported": {
          enum6 = 27;
          break;
        }
        case "no-tty": {
          enum6 = 28;
          break;
        }
        case "no-such-device": {
          enum6 = 29;
          break;
        }
        case "overflow": {
          enum6 = 30;
          break;
        }
        case "not-permitted": {
          enum6 = 31;
          break;
        }
        case "pipe": {
          enum6 = 32;
          break;
        }
        case "read-only": {
          enum6 = 33;
          break;
        }
        case "invalid-seek": {
          enum6 = 34;
          break;
        }
        case "text-file-busy": {
          enum6 = 35;
          break;
        }
        case "cross-device": {
          enum6 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val6}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant7, valueType: typeof variant7 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"][Instruction::Return]', {
    funcName: "[method]descriptor.metadata-hash-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline16.fnName = "wasi:filesystem/types@0.2.3#metadataHashAt";
var _trampoline17 = function(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "readViaStream",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.readViaStream(BigInt.asUintN(64, BigInt(arg1)))
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof InputStream2)) {
        throw new TypeError('Resource error: Not a valid "InputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable1, rep3);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.read-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline17.fnName = "wasi:filesystem/types@0.2.3#readViaStream";
var _trampoline18 = function(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "writeViaStream",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.writeViaStream(BigInt.asUintN(64, BigInt(arg1)))
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable2, rep3);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.write-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline18.fnName = "wasi:filesystem/types@0.2.3#writeViaStream";
var _trampoline19 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "appendViaStream",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.appendViaStream()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable2, rep3);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.append-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline19.fnName = "wasi:filesystem/types@0.2.3#appendViaStream";
var handleTable5 = [T_FLAG, 0];
handleTable5._createdReps = /* @__PURE__ */ new Set();
var captureTable5 = /* @__PURE__ */ new Map();
var captureCnt5 = 0;
HANDLE_TABLES[5] = handleTable5;
var _trampoline20 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "readDirectory",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.readDirectory()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof DirectoryEntryStream2)) {
        throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt5;
        captureTable5.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable5, rep3);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"][Instruction::Return]', {
    funcName: "[method]descriptor.read-directory",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline20.fnName = "wasi:filesystem/types@0.2.3#readDirectory";
var _trampoline21 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "stat",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.stat()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant12 = ret;
  switch (variant12.tag) {
    case "ok": {
      const e = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { type: v3_0, linkCount: v3_1, size: v3_2, dataAccessTimestamp: v3_3, dataModificationTimestamp: v3_4, statusChangeTimestamp: v3_5 } = e;
      var val4 = v3_0;
      let enum4;
      switch (val4) {
        case "unknown": {
          enum4 = 0;
          break;
        }
        case "block-device": {
          enum4 = 1;
          break;
        }
        case "character-device": {
          enum4 = 2;
          break;
        }
        case "directory": {
          enum4 = 3;
          break;
        }
        case "fifo": {
          enum4 = 4;
          break;
        }
        case "symbolic-link": {
          enum4 = 5;
          break;
        }
        case "regular-file": {
          enum4 = 6;
          break;
        }
        case "socket": {
          enum4 = 7;
          break;
        }
        default: {
          if (v3_0 instanceof Error) {
            console.error(v3_0);
          }
          throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      dataView(memory0).setBigInt64(arg1 + 24, toUint64(v3_2), true);
      var variant6 = v3_3;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 32, 0, true);
      } else {
        const e2 = variant6;
        dataView(memory0).setInt8(arg1 + 32, 1, true);
        var { seconds: v5_0, nanoseconds: v5_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 40, toUint64(v5_0), true);
        dataView(memory0).setInt32(arg1 + 48, toUint32(v5_1), true);
      }
      var variant8 = v3_4;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg1 + 56, 0, true);
      } else {
        const e2 = variant8;
        dataView(memory0).setInt8(arg1 + 56, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 64, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg1 + 72, toUint32(v7_1), true);
      }
      var variant10 = v3_5;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg1 + 80, 0, true);
      } else {
        const e2 = variant10;
        dataView(memory0).setInt8(arg1 + 80, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 88, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg1 + 96, toUint32(v9_1), true);
      }
      break;
    }
    case "err": {
      const e = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val11 = e;
      let enum11;
      switch (val11) {
        case "access": {
          enum11 = 0;
          break;
        }
        case "would-block": {
          enum11 = 1;
          break;
        }
        case "already": {
          enum11 = 2;
          break;
        }
        case "bad-descriptor": {
          enum11 = 3;
          break;
        }
        case "busy": {
          enum11 = 4;
          break;
        }
        case "deadlock": {
          enum11 = 5;
          break;
        }
        case "quota": {
          enum11 = 6;
          break;
        }
        case "exist": {
          enum11 = 7;
          break;
        }
        case "file-too-large": {
          enum11 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum11 = 9;
          break;
        }
        case "in-progress": {
          enum11 = 10;
          break;
        }
        case "interrupted": {
          enum11 = 11;
          break;
        }
        case "invalid": {
          enum11 = 12;
          break;
        }
        case "io": {
          enum11 = 13;
          break;
        }
        case "is-directory": {
          enum11 = 14;
          break;
        }
        case "loop": {
          enum11 = 15;
          break;
        }
        case "too-many-links": {
          enum11 = 16;
          break;
        }
        case "message-size": {
          enum11 = 17;
          break;
        }
        case "name-too-long": {
          enum11 = 18;
          break;
        }
        case "no-device": {
          enum11 = 19;
          break;
        }
        case "no-entry": {
          enum11 = 20;
          break;
        }
        case "no-lock": {
          enum11 = 21;
          break;
        }
        case "insufficient-memory": {
          enum11 = 22;
          break;
        }
        case "insufficient-space": {
          enum11 = 23;
          break;
        }
        case "not-directory": {
          enum11 = 24;
          break;
        }
        case "not-empty": {
          enum11 = 25;
          break;
        }
        case "not-recoverable": {
          enum11 = 26;
          break;
        }
        case "unsupported": {
          enum11 = 27;
          break;
        }
        case "no-tty": {
          enum11 = 28;
          break;
        }
        case "no-such-device": {
          enum11 = 29;
          break;
        }
        case "overflow": {
          enum11 = 30;
          break;
        }
        case "not-permitted": {
          enum11 = 31;
          break;
        }
        case "pipe": {
          enum11 = 32;
          break;
        }
        case "read-only": {
          enum11 = 33;
          break;
        }
        case "invalid-seek": {
          enum11 = 34;
          break;
        }
        case "text-file-busy": {
          enum11 = 35;
          break;
        }
        case "cross-device": {
          enum11 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val11}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum11, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant12, valueType: typeof variant12 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"][Instruction::Return]', {
    funcName: "[method]descriptor.stat",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline21.fnName = "wasi:filesystem/types@0.2.3#stat";
var _trampoline22 = function(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "statAt",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.statAt(flags3, result4)
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant14 = ret;
  switch (variant14.tag) {
    case "ok": {
      const e = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { type: v5_0, linkCount: v5_1, size: v5_2, dataAccessTimestamp: v5_3, dataModificationTimestamp: v5_4, statusChangeTimestamp: v5_5 } = e;
      var val6 = v5_0;
      let enum6;
      switch (val6) {
        case "unknown": {
          enum6 = 0;
          break;
        }
        case "block-device": {
          enum6 = 1;
          break;
        }
        case "character-device": {
          enum6 = 2;
          break;
        }
        case "directory": {
          enum6 = 3;
          break;
        }
        case "fifo": {
          enum6 = 4;
          break;
        }
        case "symbolic-link": {
          enum6 = 5;
          break;
        }
        case "regular-file": {
          enum6 = 6;
          break;
        }
        case "socket": {
          enum6 = 7;
          break;
        }
        default: {
          if (v5_0 instanceof Error) {
            console.error(v5_0);
          }
          throw new TypeError(`"${val6}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      dataView(memory0).setBigInt64(arg4 + 24, toUint64(v5_2), true);
      var variant8 = v5_3;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg4 + 32, 0, true);
      } else {
        const e2 = variant8;
        dataView(memory0).setInt8(arg4 + 32, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 40, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg4 + 48, toUint32(v7_1), true);
      }
      var variant10 = v5_4;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg4 + 56, 0, true);
      } else {
        const e2 = variant10;
        dataView(memory0).setInt8(arg4 + 56, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 64, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg4 + 72, toUint32(v9_1), true);
      }
      var variant12 = v5_5;
      if (variant12 === null || variant12 === void 0) {
        dataView(memory0).setInt8(arg4 + 80, 0, true);
      } else {
        const e2 = variant12;
        dataView(memory0).setInt8(arg4 + 80, 1, true);
        var { seconds: v11_0, nanoseconds: v11_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 88, toUint64(v11_0), true);
        dataView(memory0).setInt32(arg4 + 96, toUint32(v11_1), true);
      }
      break;
    }
    case "err": {
      const e = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val13 = e;
      let enum13;
      switch (val13) {
        case "access": {
          enum13 = 0;
          break;
        }
        case "would-block": {
          enum13 = 1;
          break;
        }
        case "already": {
          enum13 = 2;
          break;
        }
        case "bad-descriptor": {
          enum13 = 3;
          break;
        }
        case "busy": {
          enum13 = 4;
          break;
        }
        case "deadlock": {
          enum13 = 5;
          break;
        }
        case "quota": {
          enum13 = 6;
          break;
        }
        case "exist": {
          enum13 = 7;
          break;
        }
        case "file-too-large": {
          enum13 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum13 = 9;
          break;
        }
        case "in-progress": {
          enum13 = 10;
          break;
        }
        case "interrupted": {
          enum13 = 11;
          break;
        }
        case "invalid": {
          enum13 = 12;
          break;
        }
        case "io": {
          enum13 = 13;
          break;
        }
        case "is-directory": {
          enum13 = 14;
          break;
        }
        case "loop": {
          enum13 = 15;
          break;
        }
        case "too-many-links": {
          enum13 = 16;
          break;
        }
        case "message-size": {
          enum13 = 17;
          break;
        }
        case "name-too-long": {
          enum13 = 18;
          break;
        }
        case "no-device": {
          enum13 = 19;
          break;
        }
        case "no-entry": {
          enum13 = 20;
          break;
        }
        case "no-lock": {
          enum13 = 21;
          break;
        }
        case "insufficient-memory": {
          enum13 = 22;
          break;
        }
        case "insufficient-space": {
          enum13 = 23;
          break;
        }
        case "not-directory": {
          enum13 = 24;
          break;
        }
        case "not-empty": {
          enum13 = 25;
          break;
        }
        case "not-recoverable": {
          enum13 = 26;
          break;
        }
        case "unsupported": {
          enum13 = 27;
          break;
        }
        case "no-tty": {
          enum13 = 28;
          break;
        }
        case "no-such-device": {
          enum13 = 29;
          break;
        }
        case "overflow": {
          enum13 = 30;
          break;
        }
        case "not-permitted": {
          enum13 = 31;
          break;
        }
        case "pipe": {
          enum13 = 32;
          break;
        }
        case "read-only": {
          enum13 = 33;
          break;
        }
        case "invalid-seek": {
          enum13 = 34;
          break;
        }
        case "text-file-busy": {
          enum13 = 35;
          break;
        }
        case "cross-device": {
          enum13 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val13}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum13, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant14, valueType: typeof variant14 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"][Instruction::Return]', {
    funcName: "[method]descriptor.stat-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline22.fnName = "wasi:filesystem/types@0.2.3#statAt";
var _trampoline23 = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags5 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8)
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags6 = {
    read: Boolean(arg5 & 1),
    write: Boolean(arg5 & 2),
    fileIntegritySync: Boolean(arg5 & 4),
    dataIntegritySync: Boolean(arg5 & 8),
    requestedWriteSync: Boolean(arg5 & 16),
    mutateDirectory: Boolean(arg5 & 32)
  };
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "openAt",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.openAt(flags3, result4, flags5, flags6)
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant9 = ret;
  switch (variant9.tag) {
    case "ok": {
      const e = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 0, true);
      if (!(e instanceof Descriptor2)) {
        throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      }
      var handle7 = e[symbolRscHandle];
      if (!handle7) {
        const rep3 = e[symbolRscRep] || ++captureCnt6;
        captureTable6.set(rep3, e);
        handle7 = rscTableCreateOwn(handleTable6, rep3);
      }
      dataView(memory0).setInt32(arg6 + 4, handle7, true);
      break;
    }
    case "err": {
      const e = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 1, true);
      var val8 = e;
      let enum8;
      switch (val8) {
        case "access": {
          enum8 = 0;
          break;
        }
        case "would-block": {
          enum8 = 1;
          break;
        }
        case "already": {
          enum8 = 2;
          break;
        }
        case "bad-descriptor": {
          enum8 = 3;
          break;
        }
        case "busy": {
          enum8 = 4;
          break;
        }
        case "deadlock": {
          enum8 = 5;
          break;
        }
        case "quota": {
          enum8 = 6;
          break;
        }
        case "exist": {
          enum8 = 7;
          break;
        }
        case "file-too-large": {
          enum8 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum8 = 9;
          break;
        }
        case "in-progress": {
          enum8 = 10;
          break;
        }
        case "interrupted": {
          enum8 = 11;
          break;
        }
        case "invalid": {
          enum8 = 12;
          break;
        }
        case "io": {
          enum8 = 13;
          break;
        }
        case "is-directory": {
          enum8 = 14;
          break;
        }
        case "loop": {
          enum8 = 15;
          break;
        }
        case "too-many-links": {
          enum8 = 16;
          break;
        }
        case "message-size": {
          enum8 = 17;
          break;
        }
        case "name-too-long": {
          enum8 = 18;
          break;
        }
        case "no-device": {
          enum8 = 19;
          break;
        }
        case "no-entry": {
          enum8 = 20;
          break;
        }
        case "no-lock": {
          enum8 = 21;
          break;
        }
        case "insufficient-memory": {
          enum8 = 22;
          break;
        }
        case "insufficient-space": {
          enum8 = 23;
          break;
        }
        case "not-directory": {
          enum8 = 24;
          break;
        }
        case "not-empty": {
          enum8 = 25;
          break;
        }
        case "not-recoverable": {
          enum8 = 26;
          break;
        }
        case "unsupported": {
          enum8 = 27;
          break;
        }
        case "no-tty": {
          enum8 = 28;
          break;
        }
        case "no-such-device": {
          enum8 = 29;
          break;
        }
        case "overflow": {
          enum8 = 30;
          break;
        }
        case "not-permitted": {
          enum8 = 31;
          break;
        }
        case "pipe": {
          enum8 = 32;
          break;
        }
        case "read-only": {
          enum8 = 33;
          break;
        }
        case "invalid-seek": {
          enum8 = 34;
          break;
        }
        case "text-file-busy": {
          enum8 = 35;
          break;
        }
        case "cross-device": {
          enum8 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val8}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg6 + 4, enum8, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant9, valueType: typeof variant9 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"][Instruction::Return]', {
    funcName: "[method]descriptor.open-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline23.fnName = "wasi:filesystem/types@0.2.3#openAt";
var _trampoline24 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(DirectoryEntryStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "readDirectoryEntry",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.readDirectoryEntry()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant8 = ret;
  switch (variant8.tag) {
    case "ok": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var variant6 = e;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 4, 0, true);
      } else {
        const e2 = variant6;
        dataView(memory0).setInt8(arg1 + 4, 1, true);
        var { type: v3_0, name: v3_1 } = e2;
        var val4 = v3_0;
        let enum4;
        switch (val4) {
          case "unknown": {
            enum4 = 0;
            break;
          }
          case "block-device": {
            enum4 = 1;
            break;
          }
          case "character-device": {
            enum4 = 2;
            break;
          }
          case "directory": {
            enum4 = 3;
            break;
          }
          case "fifo": {
            enum4 = 4;
            break;
          }
          case "symbolic-link": {
            enum4 = 5;
            break;
          }
          case "regular-file": {
            enum4 = 6;
            break;
          }
          case "socket": {
            enum4 = 7;
            break;
          }
          default: {
            if (v3_0 instanceof Error) {
              console.error(v3_0);
            }
            throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
          }
        }
        dataView(memory0).setInt8(arg1 + 8, enum4, true);
        var encodeRes = _utf8AllocateAndEncode(v3_1, realloc0, memory0);
        var ptr5 = encodeRes.ptr;
        var len5 = encodeRes.len;
        dataView(memory0).setUint32(arg1 + 16, len5, true);
        dataView(memory0).setUint32(arg1 + 12, ptr5, true);
      }
      break;
    }
    case "err": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val7 = e;
      let enum7;
      switch (val7) {
        case "access": {
          enum7 = 0;
          break;
        }
        case "would-block": {
          enum7 = 1;
          break;
        }
        case "already": {
          enum7 = 2;
          break;
        }
        case "bad-descriptor": {
          enum7 = 3;
          break;
        }
        case "busy": {
          enum7 = 4;
          break;
        }
        case "deadlock": {
          enum7 = 5;
          break;
        }
        case "quota": {
          enum7 = 6;
          break;
        }
        case "exist": {
          enum7 = 7;
          break;
        }
        case "file-too-large": {
          enum7 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum7 = 9;
          break;
        }
        case "in-progress": {
          enum7 = 10;
          break;
        }
        case "interrupted": {
          enum7 = 11;
          break;
        }
        case "invalid": {
          enum7 = 12;
          break;
        }
        case "io": {
          enum7 = 13;
          break;
        }
        case "is-directory": {
          enum7 = 14;
          break;
        }
        case "loop": {
          enum7 = 15;
          break;
        }
        case "too-many-links": {
          enum7 = 16;
          break;
        }
        case "message-size": {
          enum7 = 17;
          break;
        }
        case "name-too-long": {
          enum7 = 18;
          break;
        }
        case "no-device": {
          enum7 = 19;
          break;
        }
        case "no-entry": {
          enum7 = 20;
          break;
        }
        case "no-lock": {
          enum7 = 21;
          break;
        }
        case "insufficient-memory": {
          enum7 = 22;
          break;
        }
        case "insufficient-space": {
          enum7 = 23;
          break;
        }
        case "not-directory": {
          enum7 = 24;
          break;
        }
        case "not-empty": {
          enum7 = 25;
          break;
        }
        case "not-recoverable": {
          enum7 = 26;
          break;
        }
        case "unsupported": {
          enum7 = 27;
          break;
        }
        case "no-tty": {
          enum7 = 28;
          break;
        }
        case "no-such-device": {
          enum7 = 29;
          break;
        }
        case "overflow": {
          enum7 = 30;
          break;
        }
        case "not-permitted": {
          enum7 = 31;
          break;
        }
        case "pipe": {
          enum7 = 32;
          break;
        }
        case "read-only": {
          enum7 = 33;
          break;
        }
        case "invalid-seek": {
          enum7 = 34;
          break;
        }
        case "text-file-busy": {
          enum7 = 35;
          break;
        }
        case "cross-device": {
          enum7 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val7}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum7, true);
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant8, valueType: typeof variant8 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"][Instruction::Return]', {
    funcName: "[method]directory-entry-stream.read-directory-entry",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline24.fnName = "wasi:filesystem/types@0.2.3#readDirectoryEntry";
var _trampoline25 = function(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "read",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.read(BigInt.asUintN(64, BigInt(arg1)))
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e;
      var len3 = Array.isArray(val3) ? val3.length : val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      let valData3;
      const valLenBytes3 = len3 * 1;
      if (Array.isArray(val3)) {
        let offset = 0;
        const dv3 = new DataView(memory0.buffer);
        for (const v of val3) {
          _requireValidNumericPrimitive.bind(null, "u8")(v);
          dv3.setUint8(ptr3 + offset, v, true);
          offset += 1;
        }
      } else {
        valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
        const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
        out3.set(valData3);
      }
      dataView(memory0).setUint32(arg2 + 8, len3, true);
      dataView(memory0).setUint32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"][Instruction::Return]', {
    funcName: "[method]input-stream.read",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline25.fnName = "wasi:io/streams@0.2.3#read";
var _trampoline26 = function(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "blockingRead",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.blockingRead(BigInt.asUintN(64, BigInt(arg1)))
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e;
      var len3 = Array.isArray(val3) ? val3.length : val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      let valData3;
      const valLenBytes3 = len3 * 1;
      if (Array.isArray(val3)) {
        let offset = 0;
        const dv3 = new DataView(memory0.buffer);
        for (const v of val3) {
          _requireValidNumericPrimitive.bind(null, "u8")(v);
          dv3.setUint8(ptr3 + offset, v, true);
          offset += 1;
        }
      } else {
        valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
        const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
        out3.set(valData3);
      }
      dataView(memory0).setUint32(arg2 + 8, len3, true);
      dataView(memory0).setUint32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"][Instruction::Return]', {
    funcName: "[method]input-stream.blocking-read",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline26.fnName = "wasi:io/streams@0.2.3#blockingRead";
var _trampoline27 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "checkWrite",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.checkWrite()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(e), true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg1 + 8, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e2[symbolRscHandle];
          if (!handle3) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle3 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg1 + 12, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 8, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"][Instruction::Return]', {
    funcName: "[method]output-stream.check-write",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline27.fnName = "wasi:io/streams@0.2.3#checkWrite";
var _trampoline28 = function(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "write",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.write(result3)
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"][Instruction::Return]', {
    funcName: "[method]output-stream.write",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline28.fnName = "wasi:io/streams@0.2.3#write";
var _trampoline29 = function(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "blockingWriteAndFlush",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.blockingWriteAndFlush(result3)
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"][Instruction::Return]', {
    funcName: "[method]output-stream.blocking-write-and-flush",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline29.fnName = "wasi:io/streams@0.2.3#blockingWriteAndFlush";
var _trampoline30 = function(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "blockingFlush",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = {
      tag: "ok",
      val: _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.blockingFlush()
      })
    };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg1 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e2[symbolRscHandle];
          if (!handle3) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle3 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg1 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"][Instruction::Return]', {
    funcName: "[method]output-stream.blocking-flush",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline30.fnName = "wasi:io/streams@0.2.3#blockingFlush";
var _trampoline31 = function(arg0, arg1) {
  _debugLog('[iface="wasi:random/random@0.2.3", function="get-random-bytes"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getRandomBytes",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getRandomBytes(BigInt.asUintN(64, BigInt(arg0)))
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var val0 = ret;
  var len0 = Array.isArray(val0) ? val0.length : val0.byteLength;
  var ptr0 = realloc0(0, 0, 1, len0 * 1);
  let valData0;
  const valLenBytes0 = len0 * 1;
  if (Array.isArray(val0)) {
    let offset = 0;
    const dv0 = new DataView(memory0.buffer);
    for (const v of val0) {
      _requireValidNumericPrimitive.bind(null, "u8")(v);
      dv0.setUint8(ptr0 + offset, v, true);
      offset += 1;
    }
  } else {
    valData0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, valLenBytes0);
    const out0 = new Uint8Array(memory0.buffer, ptr0, valLenBytes0);
    out0.set(valData0);
  }
  dataView(memory0).setUint32(arg1 + 4, len0, true);
  dataView(memory0).setUint32(arg1 + 0, ptr0, true);
  _debugLog('[iface="wasi:random/random@0.2.3", function="get-random-bytes"][Instruction::Return]', {
    funcName: "get-random-bytes",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline31.fnName = "wasi:random/random@0.2.3#getRandomBytes";
var _trampoline32 = function(arg0) {
  _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getDirectories",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getDirectories()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 12);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 12;
    var [tuple0_0, tuple0_1] = e;
    if (!(tuple0_0 instanceof Descriptor2)) {
      throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
    }
    var handle1 = tuple0_0[symbolRscHandle];
    if (!handle1) {
      const rep2 = tuple0_0[symbolRscRep] || ++captureCnt6;
      captureTable6.set(rep2, tuple0_0);
      handle1 = rscTableCreateOwn(handleTable6, rep2);
    }
    dataView(memory0).setInt32(base + 0, handle1, true);
    var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
    var ptr2 = encodeRes.ptr;
    var len2 = encodeRes.len;
    dataView(memory0).setUint32(base + 8, len2, true);
    dataView(memory0).setUint32(base + 4, ptr2, true);
  }
  dataView(memory0).setUint32(arg0 + 4, len3, true);
  dataView(memory0).setUint32(arg0 + 0, result3, true);
  _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"][Instruction::Return]', {
    funcName: "get-directories",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline32.fnName = "wasi:filesystem/preopens@0.2.3#getDirectories";
var handleTable3 = [T_FLAG, 0];
handleTable3._createdReps = /* @__PURE__ */ new Set();
var captureTable3 = /* @__PURE__ */ new Map();
var captureCnt3 = 0;
HANDLE_TABLES[3] = handleTable3;
var _trampoline33 = function(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getTerminalStdin",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getTerminalStdin()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalInput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt3;
      captureTable3.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable3, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"][Instruction::Return]', {
    funcName: "get-terminal-stdin",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline33.fnName = "wasi:cli/terminal-stdin@0.2.3#getTerminalStdin";
var handleTable4 = [T_FLAG, 0];
handleTable4._createdReps = /* @__PURE__ */ new Set();
var captureTable4 = /* @__PURE__ */ new Map();
var captureCnt4 = 0;
HANDLE_TABLES[4] = handleTable4;
var _trampoline34 = function(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getTerminalStdout",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getTerminalStdout()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable4, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"][Instruction::Return]', {
    funcName: "get-terminal-stdout",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline34.fnName = "wasi:cli/terminal-stdout@0.2.3#getTerminalStdout";
var _trampoline35 = function(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"] [Instruction::CallInterface] (sync, @ enter)');
  const hostProvided = true;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: -1,
      isAsync: false,
      entryFnName: "getTerminalStderr",
      getCallbackFn: () => null,
      callbackFnName: null,
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(
      0,
      _getGlobalCurrentTaskMeta(0)?.taskID
    )?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    if (hostProvided) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
      }
      task.setParentSubtask(subtask);
    }
  }
  const started = task.enterSync();
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      componentIdx: task.componentIdx(),
      taskID: task.id(),
      fn: () => getTerminalStderr()
    });
  } catch (err) {
    _debugLog("[Instruction::CallInterface] error during sync call", {
      taskID: task.id(),
      subtaskID: task.getParentSubtask()?.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable4, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"][Instruction::Return]', {
    funcName: "get-terminal-stderr",
    paramCount: 0,
    async: false,
    postReturn: false
  });
  task.resolve([ret]);
  task.exit();
};
_trampoline35.fnName = "wasi:cli/terminal-stderr@0.2.3#getTerminalStderr";
var exports3;
var realloc1;
var realloc1Async;
var postReturn0;
var postReturn0Async;
var postReturn1;
var postReturn1Async;
var exports1Generate;
function generate(arg0, arg1) {
  if (!_initialized) throwUninitialized();
  var ptr0 = realloc1(0, 0, 4, 88);
  var val1 = arg0;
  var len1 = Array.isArray(val1) ? val1.length : val1.byteLength;
  var ptr1 = realloc1(0, 0, 1, len1 * 1);
  let valData1;
  const valLenBytes1 = len1 * 1;
  if (Array.isArray(val1)) {
    let offset = 0;
    const dv1 = new DataView(memory0.buffer);
    for (const v of val1) {
      _requireValidNumericPrimitive.bind(null, "u8")(v);
      dv1.setUint8(ptr1 + offset, v, true);
      offset += 1;
    }
  } else {
    valData1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, valLenBytes1);
    const out1 = new Uint8Array(memory0.buffer, ptr1, valLenBytes1);
    out1.set(valData1);
  }
  dataView(memory0).setUint32(ptr0 + 4, len1, true);
  dataView(memory0).setUint32(ptr0 + 0, ptr1, true);
  var { name: v2_0, noTypescript: v2_1, instantiation: v2_2, importBindings: v2_3, map: v2_4, compat: v2_5, noNodejsCompat: v2_6, base64Cutoff: v2_7, tlaCompat: v2_8, validLiftingOptimization: v2_9, tracing: v2_10, noNamespacedExports: v2_11, guest: v2_12, multiMemory: v2_13, asyncMode: v2_14, strict: v2_15, asmjs: v2_16 } = arg1;
  var encodeRes = _utf8AllocateAndEncode(v2_0, realloc1, memory0);
  var ptr3 = encodeRes.ptr;
  var len3 = encodeRes.len;
  dataView(memory0).setUint32(ptr0 + 12, len3, true);
  dataView(memory0).setUint32(ptr0 + 8, ptr3, true);
  var variant4 = v2_1;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(ptr0 + 16, 0, true);
  } else {
    const e = variant4;
    dataView(memory0).setInt8(ptr0 + 16, 1, true);
    dataView(memory0).setInt8(ptr0 + 17, e ? 1 : 0, true);
  }
  var variant6 = v2_2;
  if (variant6 === null || variant6 === void 0) {
    dataView(memory0).setInt8(ptr0 + 18, 0, true);
  } else {
    const e = variant6;
    dataView(memory0).setInt8(ptr0 + 18, 1, true);
    var variant5 = e;
    switch (variant5.tag) {
      case "async": {
        dataView(memory0).setInt8(ptr0 + 19, 0, true);
        break;
      }
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 19, 1, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`InstantiationMode\``);
      }
    }
  }
  var variant8 = v2_3;
  if (variant8 === null || variant8 === void 0) {
    dataView(memory0).setInt8(ptr0 + 20, 0, true);
  } else {
    const e = variant8;
    dataView(memory0).setInt8(ptr0 + 20, 1, true);
    var variant7 = e;
    switch (variant7.tag) {
      case "js": {
        dataView(memory0).setInt8(ptr0 + 21, 0, true);
        break;
      }
      case "hybrid": {
        dataView(memory0).setInt8(ptr0 + 21, 1, true);
        break;
      }
      case "optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 2, true);
        break;
      }
      case "direct-optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 3, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant7.tag)}\` (received \`${variant7}\`) specified for \`BindingsMode\``);
      }
    }
  }
  var variant13 = v2_4;
  if (variant13 === null || variant13 === void 0) {
    dataView(memory0).setInt8(ptr0 + 24, 0, true);
  } else {
    const e = variant13;
    dataView(memory0).setInt8(ptr0 + 24, 1, true);
    var vec12 = e;
    var len12 = vec12.length;
    var result12 = realloc1(0, 0, 4, len12 * 16);
    for (let i = 0; i < vec12.length; i++) {
      const e2 = vec12[i];
      const base = result12 + i * 16;
      var [tuple9_0, tuple9_1] = e2;
      var encodeRes = _utf8AllocateAndEncode(tuple9_0, realloc1, memory0);
      var ptr10 = encodeRes.ptr;
      var len10 = encodeRes.len;
      dataView(memory0).setUint32(base + 4, len10, true);
      dataView(memory0).setUint32(base + 0, ptr10, true);
      var encodeRes = _utf8AllocateAndEncode(tuple9_1, realloc1, memory0);
      var ptr11 = encodeRes.ptr;
      var len11 = encodeRes.len;
      dataView(memory0).setUint32(base + 12, len11, true);
      dataView(memory0).setUint32(base + 8, ptr11, true);
    }
    dataView(memory0).setUint32(ptr0 + 32, len12, true);
    dataView(memory0).setUint32(ptr0 + 28, result12, true);
  }
  var variant14 = v2_5;
  if (variant14 === null || variant14 === void 0) {
    dataView(memory0).setInt8(ptr0 + 36, 0, true);
  } else {
    const e = variant14;
    dataView(memory0).setInt8(ptr0 + 36, 1, true);
    dataView(memory0).setInt8(ptr0 + 37, e ? 1 : 0, true);
  }
  var variant15 = v2_6;
  if (variant15 === null || variant15 === void 0) {
    dataView(memory0).setInt8(ptr0 + 38, 0, true);
  } else {
    const e = variant15;
    dataView(memory0).setInt8(ptr0 + 38, 1, true);
    dataView(memory0).setInt8(ptr0 + 39, e ? 1 : 0, true);
  }
  var variant16 = v2_7;
  if (variant16 === null || variant16 === void 0) {
    dataView(memory0).setInt8(ptr0 + 40, 0, true);
  } else {
    const e = variant16;
    dataView(memory0).setInt8(ptr0 + 40, 1, true);
    dataView(memory0).setInt32(ptr0 + 44, toUint32(e), true);
  }
  var variant17 = v2_8;
  if (variant17 === null || variant17 === void 0) {
    dataView(memory0).setInt8(ptr0 + 48, 0, true);
  } else {
    const e = variant17;
    dataView(memory0).setInt8(ptr0 + 48, 1, true);
    dataView(memory0).setInt8(ptr0 + 49, e ? 1 : 0, true);
  }
  var variant18 = v2_9;
  if (variant18 === null || variant18 === void 0) {
    dataView(memory0).setInt8(ptr0 + 50, 0, true);
  } else {
    const e = variant18;
    dataView(memory0).setInt8(ptr0 + 50, 1, true);
    dataView(memory0).setInt8(ptr0 + 51, e ? 1 : 0, true);
  }
  var variant19 = v2_10;
  if (variant19 === null || variant19 === void 0) {
    dataView(memory0).setInt8(ptr0 + 52, 0, true);
  } else {
    const e = variant19;
    dataView(memory0).setInt8(ptr0 + 52, 1, true);
    dataView(memory0).setInt8(ptr0 + 53, e ? 1 : 0, true);
  }
  var variant20 = v2_11;
  if (variant20 === null || variant20 === void 0) {
    dataView(memory0).setInt8(ptr0 + 54, 0, true);
  } else {
    const e = variant20;
    dataView(memory0).setInt8(ptr0 + 54, 1, true);
    dataView(memory0).setInt8(ptr0 + 55, e ? 1 : 0, true);
  }
  var variant21 = v2_12;
  if (variant21 === null || variant21 === void 0) {
    dataView(memory0).setInt8(ptr0 + 56, 0, true);
  } else {
    const e = variant21;
    dataView(memory0).setInt8(ptr0 + 56, 1, true);
    dataView(memory0).setInt8(ptr0 + 57, e ? 1 : 0, true);
  }
  var variant22 = v2_13;
  if (variant22 === null || variant22 === void 0) {
    dataView(memory0).setInt8(ptr0 + 58, 0, true);
  } else {
    const e = variant22;
    dataView(memory0).setInt8(ptr0 + 58, 1, true);
    dataView(memory0).setInt8(ptr0 + 59, e ? 1 : 0, true);
  }
  var variant29 = v2_14;
  if (variant29 === null || variant29 === void 0) {
    dataView(memory0).setInt8(ptr0 + 60, 0, true);
  } else {
    const e = variant29;
    dataView(memory0).setInt8(ptr0 + 60, 1, true);
    var variant28 = e;
    switch (variant28.tag) {
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 64, 0, true);
        break;
      }
      case "jspi": {
        const e2 = variant28.val;
        dataView(memory0).setInt8(ptr0 + 64, 1, true);
        var { imports: v23_0, exports: v23_1 } = e2;
        var vec25 = v23_0;
        var len25 = vec25.length;
        var result25 = realloc1(0, 0, 4, len25 * 8);
        for (let i = 0; i < vec25.length; i++) {
          const e3 = vec25[i];
          const base = result25 + i * 8;
          var encodeRes = _utf8AllocateAndEncode(e3, realloc1, memory0);
          var ptr24 = encodeRes.ptr;
          var len24 = encodeRes.len;
          dataView(memory0).setUint32(base + 4, len24, true);
          dataView(memory0).setUint32(base + 0, ptr24, true);
        }
        dataView(memory0).setUint32(ptr0 + 72, len25, true);
        dataView(memory0).setUint32(ptr0 + 68, result25, true);
        var vec27 = v23_1;
        var len27 = vec27.length;
        var result27 = realloc1(0, 0, 4, len27 * 8);
        for (let i = 0; i < vec27.length; i++) {
          const e3 = vec27[i];
          const base = result27 + i * 8;
          var encodeRes = _utf8AllocateAndEncode(e3, realloc1, memory0);
          var ptr26 = encodeRes.ptr;
          var len26 = encodeRes.len;
          dataView(memory0).setUint32(base + 4, len26, true);
          dataView(memory0).setUint32(base + 0, ptr26, true);
        }
        dataView(memory0).setUint32(ptr0 + 80, len27, true);
        dataView(memory0).setUint32(ptr0 + 76, result27, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant28.tag)}\` (received \`${variant28}\`) specified for \`AsyncMode\``);
      }
    }
  }
  var variant30 = v2_15;
  if (variant30 === null || variant30 === void 0) {
    dataView(memory0).setInt8(ptr0 + 84, 0, true);
  } else {
    const e = variant30;
    dataView(memory0).setInt8(ptr0 + 84, 1, true);
    dataView(memory0).setInt8(ptr0 + 85, e ? 1 : 0, true);
  }
  var variant31 = v2_16;
  if (variant31 === null || variant31 === void 0) {
    dataView(memory0).setInt8(ptr0 + 86, 0, true);
  } else {
    const e = variant31;
    dataView(memory0).setInt8(ptr0 + 86, 1, true);
    dataView(memory0).setInt8(ptr0 + 87, e ? 1 : 0, true);
  }
  _debugLog('[iface="generate", function="generate"][Instruction::CallWasm] enter', {
    funcName: "generate",
    paramCount: 1,
    async: false,
    postReturn: true
  });
  const hostProvided = false;
  const [task, _wasm_call_currentTaskID] = createNewCurrentTask({
    componentIdx: 0,
    isAsync: false,
    isManualAsync: false,
    entryFnName: "exports1Generate",
    getCallbackFn: () => null,
    callbackFnName: null,
    errHandling: "throw-result-err",
    callingWasmExport: true
  });
  const started = task.enterSync();
  if (true) {
    task.setReturnMemoryIdx(0);
    task.setReturnMemory(() => memory0());
  }
  let ret;
  try {
    ret = _withGlobalCurrentTaskMeta({
      taskID: task.id(),
      componentIdx: task.componentIdx(),
      fn: () => exports1Generate(ptr0)
    });
  } catch (err) {
    _debugLog("[Instruction::CallWasm] error during sync call", {
      taskID: task.id(),
      err
    });
    task.setErrored(err);
    task.reject(err);
    task.exit();
    throw err;
  }
  let variant41;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      var len34 = dataView(memory0).getUint32(ret + 8, true);
      var base34 = dataView(memory0).getUint32(ret + 4, true);
      var result34 = [];
      for (let i = 0; i < len34; i++) {
        const base = base34 + i * 16;
        var ptr32 = dataView(memory0).getUint32(base + 0, true);
        var len32 = dataView(memory0).getUint32(base + 4, true);
        var result32 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr32, len32));
        var ptr33 = dataView(memory0).getUint32(base + 8, true);
        var len33 = dataView(memory0).getUint32(base + 12, true);
        var result33 = new Uint8Array(memory0.buffer.slice(ptr33, ptr33 + len33 * 1));
        result34.push([result32, result33]);
      }
      var len36 = dataView(memory0).getUint32(ret + 16, true);
      var base36 = dataView(memory0).getUint32(ret + 12, true);
      var result36 = [];
      for (let i = 0; i < len36; i++) {
        const base = base36 + i * 8;
        var ptr35 = dataView(memory0).getUint32(base + 0, true);
        var len35 = dataView(memory0).getUint32(base + 4, true);
        var result35 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr35, len35));
        result36.push(result35);
      }
      var len39 = dataView(memory0).getUint32(ret + 24, true);
      var base39 = dataView(memory0).getUint32(ret + 20, true);
      var result39 = [];
      for (let i = 0; i < len39; i++) {
        const base = base39 + i * 12;
        var ptr37 = dataView(memory0).getUint32(base + 0, true);
        var len37 = dataView(memory0).getUint32(base + 4, true);
        var result37 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr37, len37));
        let enum38;
        switch (dataView(memory0).getUint8(base + 8, true)) {
          case 0: {
            enum38 = "function";
            break;
          }
          case 1: {
            enum38 = "instance";
            break;
          }
          default: {
            throw new TypeError("invalid discriminant specified for ExportType");
          }
        }
        result39.push([result37, enum38]);
      }
      variant41 = {
        tag: "ok",
        val: {
          files: result34,
          imports: result36,
          exports: result39
        }
      };
      break;
    }
    case 1: {
      var ptr40 = dataView(memory0).getUint32(ret + 4, true);
      var len40 = dataView(memory0).getUint32(ret + 8, true);
      var result40 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr40, len40));
      variant41 = {
        tag: "err",
        val: result40
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  _debugLog('[iface="generate", function="generate"][Instruction::Return]', {
    funcName: "generate",
    paramCount: 1,
    async: false,
    postReturn: true
  });
  const retCopy = variant41;
  task.resolve([retCopy.val]);
  let cstate = getOrCreateAsyncState(0);
  cstate.mayLeave = false;
  postReturn0(ret);
  cstate.mayLeave = true;
  task.exit();
  if (typeof retCopy === "object" && retCopy.tag === "err") {
    throw new ComponentError(retCopy.val);
  }
  return retCopy.val;
}
var exports1GenerateTypes;
function trampoline0(handle) {
  const handleEntry = rscTableRemove(handleTable5, handle);
  if (handleEntry.own) {
    const rsc = captureTable5.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable5.delete(handleEntry.rep);
    } else if (DirectoryEntryStream2[symbolCabiDispose]) {
      DirectoryEntryStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline1(handle) {
  const handleEntry = rscTableRemove(handleTable2, handle);
  if (handleEntry.own) {
    const rsc = captureTable2.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable2.delete(handleEntry.rep);
    } else if (OutputStream2[symbolCabiDispose]) {
      OutputStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline2(handle) {
  const handleEntry = rscTableRemove(handleTable0, handle);
  if (handleEntry.own) {
    const rsc = captureTable0.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable0.delete(handleEntry.rep);
    } else if (Error$1[symbolCabiDispose]) {
      Error$1[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline3(handle) {
  const handleEntry = rscTableRemove(handleTable1, handle);
  if (handleEntry.own) {
    const rsc = captureTable1.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable1.delete(handleEntry.rep);
    } else if (InputStream2[symbolCabiDispose]) {
      InputStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline4(handle) {
  const handleEntry = rscTableRemove(handleTable6, handle);
  if (handleEntry.own) {
    const rsc = captureTable6.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable6.delete(handleEntry.rep);
    } else if (Descriptor2[symbolCabiDispose]) {
      Descriptor2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
var trampoline5 = _trampoline5.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 5,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline5.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_OutputStream(obj) {
        if (!(obj instanceof OutputStream2)) {
          throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt2;
          captureTable2.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable2, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline5
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 5,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline5.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_OutputStream2(obj) {
        if (!(obj instanceof OutputStream2)) {
          throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt2;
          captureTable2.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable2, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline5
  }
);
function trampoline6(handle) {
  const handleEntry = rscTableRemove(handleTable3, handle);
  if (handleEntry.own) {
    const rsc = captureTable3.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable3.delete(handleEntry.rep);
    } else if (TerminalInput2[symbolCabiDispose]) {
      TerminalInput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline7(handle) {
  const handleEntry = rscTableRemove(handleTable4, handle);
  if (handleEntry.own) {
    const rsc = captureTable4.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable4.delete(handleEntry.rep);
    } else if (TerminalOutput2[symbolCabiDispose]) {
      TerminalOutput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
var trampoline8 = _trampoline8.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 8,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline8.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_InputStream(obj) {
        if (!(obj instanceof InputStream2)) {
          throw new TypeError('Resource error: Not a valid "InputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt1;
          captureTable1.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable1, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline8
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 8,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline8.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_InputStream2(obj) {
        if (!(obj instanceof InputStream2)) {
          throw new TypeError('Resource error: Not a valid "InputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt1;
          captureTable1.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable1, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline8
  }
);
var trampoline9 = _trampoline9.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 9,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline9.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_OutputStream3(obj) {
        if (!(obj instanceof OutputStream2)) {
          throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt2;
          captureTable2.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable2, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline9
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 9,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline9.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatOwn({
      componentIdx: 0,
      lowerFn: function lowerImportedOwnedHost_OutputStream4(obj) {
        if (!(obj instanceof OutputStream2)) {
          throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        }
        let handle = obj[symbolRscHandle];
        if (!handle) {
          const rep2 = obj[symbolRscRep] || ++captureCnt2;
          captureTable2.set(rep2, obj);
          handle = rscTableCreateOwn(handleTable2, rep2);
        }
        return handle;
      }
    })],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline9
  }
);
var trampoline10 = _trampoline10.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 10,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline10.manuallyAsync,
    paramLiftFns: [
      _liftFlatResult({
        caseMetas: [["ok", null, 0, 0, 0], ["err", null, 0, 0, 0]],
        variantSize32: 1,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 1
      })
    ],
    resultLowerFns: [],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline10
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 10,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline10.manuallyAsync,
    paramLiftFns: [
      _liftFlatResult({
        caseMetas: [["ok", null, 0, 0, 0], ["err", null, 0, 0, 0]],
        variantSize32: 1,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 1
      })
    ],
    resultLowerFns: [],
    hasResultPointer: false,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: null,
    stringEncoding: "utf8",
    getMemoryFn: () => null,
    getReallocFn: void 0,
    importFn: _trampoline10
  }
);
var trampoline11 = _trampoline11.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 11,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline11.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatTuple({ elemLowerMetas: [[_lowerFlatStringAny, 8, 4], [_lowerFlatStringAny, 8, 4]], size32: 16, align32: 4 }),
      elemSize32: 16,
      elemAlign32: 4
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline11
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 11,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline11.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatTuple({ elemLowerMetas: [[_lowerFlatStringAny, 8, 4], [_lowerFlatStringAny, 8, 4]], size32: 16, align32: 4 }),
      elemSize32: 16,
      elemAlign32: 4
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline11
  }
);
var trampoline12 = _trampoline12.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 12,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline12.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatFlags({ names: ["read", "write", "fileIntegritySync", "dataIntegritySync", "requestedWriteSync", "mutateDirectory"], size32: 1, align32: 1, intSizeBytes: 1 }), 2, 1, 1],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline12
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 12,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline12.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatFlags({ names: ["read", "write", "fileIntegritySync", "dataIntegritySync", "requestedWriteSync", "mutateDirectory"], size32: 1, align32: 1, intSizeBytes: 1 }), 2, 1, 1],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline12
  }
);
var trampoline13 = _trampoline13.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 13,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline13.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          [
            "ok",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline13
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 13,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline13.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          [
            "ok",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            2,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline13
  }
);
var trampoline14 = _trampoline14.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 14,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline14.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [["lower", _lowerFlatU64, 8, 8], ["upper", _lowerFlatU64, 8, 8]], size32: 16, align32: 8 }), 24, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            24,
            8,
            8
          ]
        ],
        variantSize32: 24,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline14
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 14,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline14.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [["lower", _lowerFlatU64, 8, 8], ["upper", _lowerFlatU64, 8, 8]], size32: 16, align32: 8 }), 24, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            24,
            8,
            8
          ]
        ],
        variantSize32: 24,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline14
  }
);
var trampoline15 = _trampoline15.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 15,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline15.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          [
            "some",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline15
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 15,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline15.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          [
            "some",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1,
            1
          ]
        ],
        variantSize32: 2,
        variantAlign32: 1,
        variantPayloadOffset32: 1,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline15
  }
);
var trampoline16 = _trampoline16.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 16,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline16.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [["lower", _lowerFlatU64, 8, 8], ["upper", _lowerFlatU64, 8, 8]], size32: 16, align32: 8 }), 24, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            24,
            8,
            8
          ]
        ],
        variantSize32: 24,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline16
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 16,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline16.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [["lower", _lowerFlatU64, 8, 8], ["upper", _lowerFlatU64, 8, 8]], size32: 16, align32: 8 }), 24, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            24,
            8,
            8
          ]
        ],
        variantSize32: 24,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline16
  }
);
var trampoline17 = _trampoline17.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 17,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline17.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_InputStream3(obj) {
              if (!(obj instanceof InputStream2)) {
                throw new TypeError('Resource error: Not a valid "InputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt1;
                captureTable1.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable1, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline17
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 17,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline17.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_InputStream4(obj) {
              if (!(obj instanceof InputStream2)) {
                throw new TypeError('Resource error: Not a valid "InputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt1;
                captureTable1.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable1, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline17
  }
);
var trampoline18 = _trampoline18.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 18,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline18.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_OutputStream5(obj) {
              if (!(obj instanceof OutputStream2)) {
                throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt2;
                captureTable2.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable2, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline18
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 18,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline18.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_OutputStream6(obj) {
              if (!(obj instanceof OutputStream2)) {
                throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt2;
                captureTable2.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable2, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline18
  }
);
var trampoline19 = _trampoline19.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 19,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline19.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_OutputStream7(obj) {
              if (!(obj instanceof OutputStream2)) {
                throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt2;
                captureTable2.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable2, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline19
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 19,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline19.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_OutputStream8(obj) {
              if (!(obj instanceof OutputStream2)) {
                throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt2;
                captureTable2.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable2, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline19
  }
);
var trampoline20 = _trampoline20.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 20,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline20.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_DirectoryEntryStream(obj) {
              if (!(obj instanceof DirectoryEntryStream2)) {
                throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt5;
                captureTable5.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable5, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline20
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 20,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline20.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_DirectoryEntryStream2(obj) {
              if (!(obj instanceof DirectoryEntryStream2)) {
                throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt5;
                captureTable5.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable5, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline20
  }
);
var trampoline21 = _trampoline21.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 21,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline21.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [[
            "type",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1
          ], ["linkCount", _lowerFlatU64, 8, 8], ["size", _lowerFlatU64, 8, 8], [
            "dataAccessTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "dataModificationTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "statusChangeTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ]], size32: 96, align32: 8 }), 104, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            104,
            8,
            8
          ]
        ],
        variantSize32: 104,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 13
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline21
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 21,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline21.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [[
            "type",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1
          ], ["linkCount", _lowerFlatU64, 8, 8], ["size", _lowerFlatU64, 8, 8], [
            "dataAccessTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "dataModificationTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "statusChangeTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ]], size32: 96, align32: 8 }), 104, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            104,
            8,
            8
          ]
        ],
        variantSize32: 104,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 13
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline21
  }
);
var trampoline22 = _trampoline22.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 22,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline22.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [[
            "type",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1
          ], ["linkCount", _lowerFlatU64, 8, 8], ["size", _lowerFlatU64, 8, 8], [
            "dataAccessTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "dataModificationTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "statusChangeTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ]], size32: 96, align32: 8 }), 104, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            104,
            8,
            8
          ]
        ],
        variantSize32: 104,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 13
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline22
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 22,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline22.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatRecord({ fieldMetas: [[
            "type",
            _lowerFlatEnum({
              caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            1,
            1
          ], ["linkCount", _lowerFlatU64, 8, 8], ["size", _lowerFlatU64, 8, 8], [
            "dataAccessTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "dataModificationTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ], [
            "statusChangeTimestamp",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [["seconds", _lowerFlatU64, 8, 8], ["nanoseconds", _lowerFlatU32, 4, 4]], size32: 16, align32: 8 }), 16, 8, 2]
              ],
              variantSize32: 24,
              variantAlign32: 8,
              variantPayloadOffset32: 8,
              variantFlatCount: 3
            }),
            24,
            8
          ]], size32: 96, align32: 8 }), 104, 8, 8],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            104,
            8,
            8
          ]
        ],
        variantSize32: 104,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 13
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline22
  }
);
var trampoline23 = _trampoline23.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 23,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline23.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny, _liftFlatFlags({ names: ["create", "directory", "exclusive", "truncate"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatFlags({ names: ["read", "write", "fileIntegritySync", "dataIntegritySync", "requestedWriteSync", "mutateDirectory"], size32: 1, align32: 1, intSizeBytes: 1 })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_Descriptor(obj) {
              if (!(obj instanceof Descriptor2)) {
                throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt6;
                captureTable6.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable6, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline23
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 23,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline23.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags({ names: ["symlinkFollow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny, _liftFlatFlags({ names: ["create", "directory", "exclusive", "truncate"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatFlags({ names: ["read", "write", "fileIntegritySync", "dataIntegritySync", "requestedWriteSync", "mutateDirectory"], size32: 1, align32: 1, intSizeBytes: 1 })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_Descriptor2(obj) {
              if (!(obj instanceof Descriptor2)) {
                throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt6;
                captureTable6.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable6, rep2);
              }
              return handle;
            }
          }), 8, 4, 4],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            8,
            4,
            4
          ]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline23
  }
);
var trampoline24 = _trampoline24.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 24,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline24.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 5)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          [
            "ok",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [[
                  "type",
                  _lowerFlatEnum({
                    caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
                    variantSize32: 1,
                    variantAlign32: 1,
                    variantPayloadOffset32: 1,
                    variantFlatCount: 1
                  }),
                  1,
                  1
                ], ["name", _lowerFlatStringAny, 8, 4]], size32: 12, align32: 4 }), 12, 4, 3]
              ],
              variantSize32: 16,
              variantAlign32: 4,
              variantPayloadOffset32: 4,
              variantFlatCount: 4
            }),
            20,
            4,
            4
          ],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            20,
            4,
            4
          ]
        ],
        variantSize32: 20,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 5
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline24
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 24,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline24.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 5)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          [
            "ok",
            _lowerFlatOption({
              caseMetas: [
                ["none", null, 0, 0, 0],
                ["some", _lowerFlatRecord({ fieldMetas: [[
                  "type",
                  _lowerFlatEnum({
                    caseMetas: [["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]],
                    variantSize32: 1,
                    variantAlign32: 1,
                    variantPayloadOffset32: 1,
                    variantFlatCount: 1
                  }),
                  1,
                  1
                ], ["name", _lowerFlatStringAny, 8, 4]], size32: 12, align32: 4 }), 12, 4, 3]
              ],
              variantSize32: 16,
              variantAlign32: 4,
              variantPayloadOffset32: 4,
              variantFlatCount: 4
            }),
            20,
            4,
            4
          ],
          [
            "err",
            _lowerFlatEnum({
              caseMetas: [["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]],
              variantSize32: 1,
              variantAlign32: 1,
              variantPayloadOffset32: 1,
              variantFlatCount: 1
            }),
            20,
            4,
            4
          ]
        ],
        variantSize32: 20,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 5
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline24
  }
);
var trampoline25 = _trampoline25.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 25,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline25.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatList({
            elemLowerFn: _lowerFlatU8,
            elemSize32: 1,
            elemAlign32: 1
          }), 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$1(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline25
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 25,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline25.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatList({
            elemLowerFn: _lowerFlatU8,
            elemSize32: 1,
            elemAlign32: 1
          }), 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$12(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline25
  }
);
var trampoline26 = _trampoline26.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 26,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline26.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatList({
            elemLowerFn: _lowerFlatU8,
            elemSize32: 1,
            elemAlign32: 1
          }), 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$13(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline26
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 26,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline26.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatList({
            elemLowerFn: _lowerFlatU8,
            elemSize32: 1,
            elemAlign32: 1
          }), 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$14(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline26
  }
);
var trampoline27 = _trampoline27.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 27,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline27.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatU64, 16, 8, 8],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$15(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 16, 8, 8]
        ],
        variantSize32: 16,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline27
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 27,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline27.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", _lowerFlatU64, 16, 8, 8],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$16(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 16, 8, 8]
        ],
        variantSize32: 16,
        variantAlign32: 8,
        variantPayloadOffset32: 8,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline27
  }
);
var trampoline28 = _trampoline28.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 28,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline28.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList({
      elemLiftFn: _liftFlatU8,
      elemAlign32: 1,
      elemSize32: 1,
      typedArray: Uint8Array
    })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$17(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline28
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 28,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline28.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList({
      elemLiftFn: _liftFlatU8,
      elemAlign32: 1,
      elemSize32: 1,
      typedArray: Uint8Array
    })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$18(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline28
  }
);
var trampoline29 = _trampoline29.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 29,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline29.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList({
      elemLiftFn: _liftFlatU8,
      elemAlign32: 1,
      elemSize32: 1,
      typedArray: Uint8Array
    })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$19(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline29
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 29,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline29.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList({
      elemLiftFn: _liftFlatU8,
      elemAlign32: 1,
      elemSize32: 1,
      typedArray: Uint8Array
    })],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$110(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline29
  }
);
var trampoline30 = _trampoline30.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 30,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline30.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$111(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline30
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 30,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline30.manuallyAsync,
    paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
    resultLowerFns: [
      _lowerFlatResult({
        caseMetas: [
          ["ok", null, 12, 4, 4],
          ["err", _lowerFlatVariant({
            caseMetas: [["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: function lowerImportedOwnedHost_Error$112(obj) {
                if (!(obj instanceof Error$1)) {
                  throw new TypeError('Resource error: Not a valid "Error$1" resource.');
                }
                let handle = obj[symbolRscHandle];
                if (!handle) {
                  const rep2 = obj[symbolRscRep] || ++captureCnt0;
                  captureTable0.set(rep2, obj);
                  handle = rscTableCreateOwn(handleTable0, rep2);
                }
                return handle;
              }
            }), 4, 4, 1], ["closed", null, 0, 0, 0]],
            variantSize32: 8,
            variantAlign32: 4,
            variantPayloadOffset32: 4,
            variantFlatCount: 2
          }), 12, 4, 4]
        ],
        variantSize32: 12,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 3
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline30
  }
);
var trampoline31 = _trampoline31.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 31,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline31.manuallyAsync,
    paramLiftFns: [_liftFlatU64],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatU8,
      elemSize32: 1,
      elemAlign32: 1
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline31
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 31,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline31.manuallyAsync,
    paramLiftFns: [_liftFlatU64],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatU8,
      elemSize32: 1,
      elemAlign32: 1
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline31
  }
);
var trampoline32 = _trampoline32.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 32,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline32.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatTuple({ elemLowerMetas: [[_lowerFlatOwn({
        componentIdx: 0,
        lowerFn: function lowerImportedOwnedHost_Descriptor3(obj) {
          if (!(obj instanceof Descriptor2)) {
            throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
          }
          let handle = obj[symbolRscHandle];
          if (!handle) {
            const rep2 = obj[symbolRscRep] || ++captureCnt6;
            captureTable6.set(rep2, obj);
            handle = rscTableCreateOwn(handleTable6, rep2);
          }
          return handle;
        }
      }), 4, 4], [_lowerFlatStringAny, 8, 4]], size32: 12, align32: 4 }),
      elemSize32: 12,
      elemAlign32: 4
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline32
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 32,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline32.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [_lowerFlatList({
      elemLowerFn: _lowerFlatTuple({ elemLowerMetas: [[_lowerFlatOwn({
        componentIdx: 0,
        lowerFn: function lowerImportedOwnedHost_Descriptor4(obj) {
          if (!(obj instanceof Descriptor2)) {
            throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
          }
          let handle = obj[symbolRscHandle];
          if (!handle) {
            const rep2 = obj[symbolRscRep] || ++captureCnt6;
            captureTable6.set(rep2, obj);
            handle = rscTableCreateOwn(handleTable6, rep2);
          }
          return handle;
        }
      }), 4, 4], [_lowerFlatStringAny, 8, 4]], size32: 12, align32: 4 }),
      elemSize32: 12,
      elemAlign32: 4
    })],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: () => realloc0,
    importFn: _trampoline32
  }
);
var trampoline33 = _trampoline33.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 33,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline33.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalInput(obj) {
              if (!(obj instanceof TerminalInput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt3;
                captureTable3.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable3, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline33
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 33,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline33.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalInput2(obj) {
              if (!(obj instanceof TerminalInput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt3;
                captureTable3.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable3, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline33
  }
);
var trampoline34 = _trampoline34.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 34,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline34.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalOutput(obj) {
              if (!(obj instanceof TerminalOutput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt4;
                captureTable4.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable4, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline34
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 34,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline34.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalOutput2(obj) {
              if (!(obj instanceof TerminalOutput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt4;
                captureTable4.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable4, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline34
  }
);
var trampoline35 = _trampoline35.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 35,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline35.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalOutput3(obj) {
              if (!(obj instanceof TerminalOutput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt4;
                captureTable4.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable4, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline35
  }
)) : _lowerImportBackwardsCompat.bind(
  null,
  {
    trampolineIdx: 35,
    componentIdx: 0,
    isAsync: false,
    isManualAsync: _trampoline35.manuallyAsync,
    paramLiftFns: [],
    resultLowerFns: [
      _lowerFlatOption({
        caseMetas: [
          ["none", null, 0, 0, 0],
          ["some", _lowerFlatOwn({
            componentIdx: 0,
            lowerFn: function lowerImportedOwnedHost_TerminalOutput4(obj) {
              if (!(obj instanceof TerminalOutput2)) {
                throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
              }
              let handle = obj[symbolRscHandle];
              if (!handle) {
                const rep2 = obj[symbolRscRep] || ++captureCnt4;
                captureTable4.set(rep2, obj);
                handle = rscTableCreateOwn(handleTable4, rep2);
              }
              return handle;
            }
          }), 4, 4, 1]
        ],
        variantSize32: 8,
        variantAlign32: 4,
        variantPayloadOffset32: 4,
        variantFlatCount: 2
      })
    ],
    hasResultPointer: true,
    funcTypeIsAsync: false,
    getCallbackFn: () => null,
    getPostReturnFn: () => null,
    isCancellable: false,
    memoryIdx: 0,
    stringEncoding: "utf8",
    getMemoryFn: () => memory0,
    getReallocFn: void 0,
    importFn: _trampoline35
  }
);
var _initialized = false;
var $init = (() => {
  let gen = function* _initGenerator() {
    const module0 = fetchCompile(new URL("./js-component-bindgen-component.core.wasm", import.meta.url));
    const module1 = fetchCompile(new URL("./js-component-bindgen-component.core2.wasm", import.meta.url));
    const module2 = base64Compile("AGFzbQEAAAABZw5gAn9/AGACf38Bf2ABfwBgA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGABfwF/YAN/f38Bf2AFf39/fn8Bf2AFf39/f38Bf2AJf39/f39+fn9/AX9gB39/f39/f38AYAJ+fwADKCcBAQEHAQEBCAQJBAoLAgIAAAAABQMDAAAABQwAAwMABgYADQICAgIEBQFwAScnB8UBKAEwAAABMQABATIAAgEzAAMBNAAEATUABQE2AAYBNwAHATgACAE5AAkCMTAACgIxMQALAjEyAAwCMTMADQIxNAAOAjE1AA8CMTYAEAIxNwARAjE4ABICMTkAEwIyMAAUAjIxABUCMjIAFgIyMwAXAjI0ABgCMjUAGQIyNgAaAjI3ABsCMjgAHAIyOQAdAjMwAB4CMzEAHwIzMgAgAjMzACECMzQAIgIzNQAjAjM2ACQCMzcAJQIzOAAmCCRpbXBvcnRzAQAKkQQnCwAgACABQQARAQALCwAgACABQQERAQALCwAgACABQQIRAQALCQAgAEEDEQcACwsAIAAgAUEEEQEACwsAIAAgAUEFEQEACwsAIAAgAUEGEQEACw0AIAAgASACQQcRCAALDwAgACABIAIgA0EIEQQACxEAIAAgASACIAMgBEEJEQkACw8AIAAgASACIANBChEEAAsRACAAIAEgAiADIARBCxEKAAsZACAAIAEgAiADIAQgBSAGIAcgCEEMEQsACwkAIABBDRECAAsJACAAQQ4RAgALCwAgACABQQ8RAAALCwAgACABQRARAAALCwAgACABQRERAAALCwAgACABQRIRAAALEQAgACABIAIgAyAEQRMRBQALDQAgACABIAJBFBEDAAsNACAAIAEgAkEVEQMACwsAIAAgAUEWEQAACwsAIAAgAUEXEQAACwsAIAAgAUEYEQAACxEAIAAgASACIAMgBEEZEQUACxUAIAAgASACIAMgBCAFIAZBGhEMAAsLACAAIAFBGxEAAAsNACAAIAEgAkEcEQMACw0AIAAgASACQR0RAwALCwAgACABQR4RAAALDwAgACABIAIgA0EfEQYACw8AIAAgASACIANBIBEGAAsLACAAIAFBIREAAAsLACAAIAFBIhENAAsJACAAQSMRAgALCQAgAEEkEQIACwkAIABBJRECAAsJACAAQSYRAgALAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yNTEuMA");
    const module3 = base64Compile("AGFzbQEAAAABZw5gAn9/AGACf38Bf2ABfwBgA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGABfwF/YAN/f38Bf2AFf39/fn8Bf2AFf39/f38Bf2AJf39/f39+fn9/AX9gB39/f39/f38AYAJ+fwAC8AEoAAEwAAEAATEAAQABMgABAAEzAAcAATQAAQABNQABAAE2AAEAATcACAABOAAEAAE5AAkAAjEwAAQAAjExAAoAAjEyAAsAAjEzAAIAAjE0AAIAAjE1AAAAAjE2AAAAAjE3AAAAAjE4AAAAAjE5AAUAAjIwAAMAAjIxAAMAAjIyAAAAAjIzAAAAAjI0AAAAAjI1AAUAAjI2AAwAAjI3AAAAAjI4AAMAAjI5AAMAAjMwAAAAAjMxAAYAAjMyAAYAAjMzAAAAAjM0AA0AAjM1AAIAAjM2AAIAAjM3AAIAAjM4AAIACCRpbXBvcnRzAXABJycJLQEAQQALJwABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJgAvCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BzAuMjUxLjA");
    ({ exports: exports0 } = yield instantiateCore(yield module2));
    ({ exports: exports1 } = yield instantiateCore(yield module0, {
      wasi_snapshot_preview1: {
        environ_get: exports0["1"],
        environ_sizes_get: exports0["2"],
        fd_close: exports0["3"],
        fd_fdstat_get: exports0["4"],
        fd_filestat_get: exports0["5"],
        fd_prestat_dir_name: exports0["7"],
        fd_prestat_get: exports0["6"],
        fd_read: exports0["8"],
        fd_readdir: exports0["9"],
        fd_write: exports0["10"],
        path_filestat_get: exports0["11"],
        path_open: exports0["12"],
        proc_exit: exports0["13"],
        random_get: exports0["0"]
      }
    }));
    ({ exports: exports2 } = yield instantiateCore(yield module1, {
      __main_module__: {
        cabi_realloc: exports1.cabi_realloc
      },
      env: {
        memory: exports1.memory
      },
      "wasi:cli/environment@0.2.3": {
        "get-environment": exports0["14"]
      },
      "wasi:cli/exit@0.2.3": {
        exit: trampoline10
      },
      "wasi:cli/stderr@0.2.3": {
        "get-stderr": trampoline5
      },
      "wasi:cli/stdin@0.2.3": {
        "get-stdin": trampoline8
      },
      "wasi:cli/stdout@0.2.3": {
        "get-stdout": trampoline9
      },
      "wasi:cli/terminal-input@0.2.3": {
        "[resource-drop]terminal-input": trampoline6
      },
      "wasi:cli/terminal-output@0.2.3": {
        "[resource-drop]terminal-output": trampoline7
      },
      "wasi:cli/terminal-stderr@0.2.3": {
        "get-terminal-stderr": exports0["38"]
      },
      "wasi:cli/terminal-stdin@0.2.3": {
        "get-terminal-stdin": exports0["36"]
      },
      "wasi:cli/terminal-stdout@0.2.3": {
        "get-terminal-stdout": exports0["37"]
      },
      "wasi:filesystem/preopens@0.2.3": {
        "get-directories": exports0["35"]
      },
      "wasi:filesystem/types@0.2.3": {
        "[method]descriptor.append-via-stream": exports0["22"],
        "[method]descriptor.get-flags": exports0["15"],
        "[method]descriptor.get-type": exports0["16"],
        "[method]descriptor.metadata-hash": exports0["17"],
        "[method]descriptor.metadata-hash-at": exports0["19"],
        "[method]descriptor.open-at": exports0["26"],
        "[method]descriptor.read-directory": exports0["23"],
        "[method]descriptor.read-via-stream": exports0["20"],
        "[method]descriptor.stat": exports0["24"],
        "[method]descriptor.stat-at": exports0["25"],
        "[method]descriptor.write-via-stream": exports0["21"],
        "[method]directory-entry-stream.read-directory-entry": exports0["27"],
        "[resource-drop]descriptor": trampoline4,
        "[resource-drop]directory-entry-stream": trampoline0,
        "filesystem-error-code": exports0["18"]
      },
      "wasi:io/error@0.2.3": {
        "[resource-drop]error": trampoline2
      },
      "wasi:io/streams@0.2.3": {
        "[method]input-stream.blocking-read": exports0["29"],
        "[method]input-stream.read": exports0["28"],
        "[method]output-stream.blocking-flush": exports0["33"],
        "[method]output-stream.blocking-write-and-flush": exports0["32"],
        "[method]output-stream.check-write": exports0["30"],
        "[method]output-stream.write": exports0["31"],
        "[resource-drop]input-stream": trampoline3,
        "[resource-drop]output-stream": trampoline1
      },
      "wasi:random/random@0.2.3": {
        "get-random-bytes": exports0["34"]
      }
    }));
    memory0 = exports1.memory;
    realloc0 = exports2.cabi_import_realloc;
    try {
      realloc0Async = WebAssembly.promising(exports2.cabi_import_realloc);
    } catch (err) {
      realloc0Async = exports2.cabi_import_realloc;
    }
    ({ exports: exports3 } = yield instantiateCore(yield module3, {
      "": {
        $imports: exports0.$imports,
        "0": exports2.random_get,
        "1": exports2.environ_get,
        "10": exports2.fd_write,
        "11": exports2.path_filestat_get,
        "12": exports2.path_open,
        "13": exports2.proc_exit,
        "14": trampoline11,
        "15": trampoline12,
        "16": trampoline13,
        "17": trampoline14,
        "18": trampoline15,
        "19": trampoline16,
        "2": exports2.environ_sizes_get,
        "20": trampoline17,
        "21": trampoline18,
        "22": trampoline19,
        "23": trampoline20,
        "24": trampoline21,
        "25": trampoline22,
        "26": trampoline23,
        "27": trampoline24,
        "28": trampoline25,
        "29": trampoline26,
        "3": exports2.fd_close,
        "30": trampoline27,
        "31": trampoline28,
        "32": trampoline29,
        "33": trampoline30,
        "34": trampoline31,
        "35": trampoline32,
        "36": trampoline33,
        "37": trampoline34,
        "38": trampoline35,
        "4": exports2.fd_fdstat_get,
        "5": exports2.fd_filestat_get,
        "6": exports2.fd_prestat_get,
        "7": exports2.fd_prestat_dir_name,
        "8": exports2.fd_read,
        "9": exports2.fd_readdir
      }
    }));
    realloc1 = exports1.cabi_realloc;
    try {
      realloc1Async = WebAssembly.promising(exports1.cabi_realloc);
    } catch (err) {
      realloc1Async = exports1.cabi_realloc;
    }
    postReturn0 = exports1.cabi_post_generate;
    try {
      postReturn0Async = WebAssembly.promising(exports1.cabi_post_generate);
    } catch (err) {
      postReturn0Async = exports1.cabi_post_generate;
    }
    postReturn1 = exports1["cabi_post_generate-types"];
    try {
      postReturn1Async = WebAssembly.promising(exports1["cabi_post_generate-types"]);
    } catch (err) {
      postReturn1Async = exports1["cabi_post_generate-types"];
    }
    _initialized = true;
    exports1Generate = exports1.generate;
    exports1GenerateTypes = exports1["generate-types"];
  }();
  let promise, resolve2, reject2;
  function runNext(value) {
    try {
      let done;
      do {
        ({ value, done } = gen.next(value));
      } while (!(value instanceof Promise) && !done);
      if (done) {
        if (resolve2) resolve2(value);
        else return value;
      }
      if (!promise) promise = new Promise((_resolve, _reject) => (resolve2 = _resolve, reject2 = _reject));
      value.then(runNext, reject2);
    } catch (e) {
      if (reject2) reject2(e);
      else throw e;
    }
  }
  const maybeSyncReturn = runNext(null);
  return promise || maybeSyncReturn;
})();

// ../../../tmp/tmp.Q58rLUOd2t/entry.js
async function transpileComponent(bytes, name) {
  await $init;
  return generate(bytes, {
    name,
    noTypescript: true,
    noNamespacedExports: true,
    instantiation: { tag: "sync" }
  });
}
export {
  transpileComponent
};
