import { decode, encode, type Message } from "./protocol";

/** Public STUN server for finding each browser's address; no relay (TURN), so very strict networks can't connect. */
const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

/** Waits until the browser has found its addresses, so the whole offer or answer goes in one message. */
function gathered(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/**
 * One connection to another player: a WebRTC data channel carrying our
 * messages, with callbacks for messages and for the link going down.
 */
export class Peer {
  onMessage: ((m: Message) => void) | null = null;
  onClose: (() => void) | null = null;
  private closed = false;

  private constructor(readonly pc: RTCPeerConnection, private channel: RTCDataChannel) {
    channel.onmessage = (e) => {
      const m = decode(e.data);
      if (m) this.onMessage?.(m);
    };
    channel.onclose = () => this.close();
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.close();
    };
  }

  get open() {
    return !this.closed && this.channel.readyState === "open";
  }

  send(m: Message) {
    if (this.open) this.channel.send(encode(m));
  }

  /** Data waiting to go out (to avoid flooding a slow link). */
  get buffered() {
    return this.channel.bufferedAmount;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.channel.close();
      this.pc.close();
    } catch {
      // Already gone.
    }
    this.onClose?.();
  }

  /** Joining side: makes an offer; `connect` takes the host's answer and resolves once the channel is open. */
  static async offer(): Promise<{ sdp: string; connect: (answer: string, timeoutMs?: number) => Promise<Peer> }> {
    const pc = new RTCPeerConnection(ICE);
    const channel = pc.createDataChannel("blockvale", { ordered: true });
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return {
      sdp: pc.localDescription!.sdp,
      connect: async (answer, timeoutMs = 15000) => {
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
        await opened(channel, timeoutMs, pc);
        return new Peer(pc, channel);
      },
    };
  }

  /** Hosting side: answers an offer; the peer arrives once the joining player's channel opens. */
  static async answer(offer: string, timeoutMs = 15000): Promise<{ sdp: string; peer: Promise<Peer> }> {
    const pc = new RTCPeerConnection(ICE);
    const channel = new Promise<RTCDataChannel>((resolve) => (pc.ondatachannel = (e) => resolve(e.channel)));
    await pc.setRemoteDescription({ type: "offer", sdp: offer });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    const peer = channel.then(async (ch) => {
      await opened(ch, timeoutMs, pc);
      return new Peer(pc, ch);
    });
    return { sdp: pc.localDescription!.sdp, peer };
  }
}

function opened(ch: RTCDataChannel, timeoutMs: number, pc: RTCPeerConnection): Promise<void> {
  if (ch.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.close();
      reject(new Error("Could not connect (your network may block direct connections)"));
    }, timeoutMs);
    ch.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}
