import { vi } from 'vitest';

import type { EngineProxy } from '../engine/EngineProxy';
import type { WorkerChannel } from '../engine/WorkerChannel.service';

/** A command or an answer as the proxy and the worker exchange it. */
export interface BridgeMessage {
    readonly type: string;
    readonly requestId?: string;
}

export interface WorkerBridge {
    /** Every command the proxy has sent, in order. */
    readonly commands: BridgeMessage[];
    /** Decides whether a command is lost before the worker receives it. */
    loseCommand: (command: BridgeMessage) => boolean;
    /** Decides whether an answer is lost before the proxy receives it. */
    loseAnswer: (answer: BridgeMessage) => boolean;
}

type MessageHandler = (event: MessageEvent<unknown>) => void;

// WorkerChannel's ASYNC_COMMAND_TIMEOUT_MS. The channel does not export it, so the tests state the value.
export const ASYNC_COMMAND_TIMEOUT_MS = 5000;
const SCALE = 1;

const SETTLE_TURNS = 10;

// Lets the proxy's pending continuations run, so the command they send is posted before the test looks for it.
export const settle = async (): Promise<void> => {
    for (let turn = 0; turn < SETTLE_TURNS; turn++) await Promise.resolve();
};

/** True for the answer to a request of the given command type. */
export const isAnswerTo = (type: string) => (message: BridgeMessage): boolean =>
    message.type === 'commandResponse' && message.requestId?.startsWith(`${type}_`) === true;

/**
 * Connects a proxy to the real worker module in this thread. Commands and answers cross in order and synchronously, as
 * they do between a page and its worker. A test can lose either one, to model a reply that never arrives. The worker
 * module is loaded fresh, so its engine starts uninitialised, and it is then initialised at a scale of 1.
 */
export const bridgeProxyToWorker = async (proxy: EngineProxy): Promise<WorkerBridge> => {
    const bridge: WorkerBridge = { commands: [], loseCommand: () => false, loseAnswer: () => false };
    const channel = (proxy as unknown as { channel: WorkerChannel }).channel;
    vi.spyOn(self, 'postMessage').mockImplementation((answer: unknown) => {
        if (!bridge.loseAnswer(answer as BridgeMessage)) channel.dispatch({ data: answer } as MessageEvent);
    });
    vi.resetModules();
    await import('../simulation.worker');
    const workerHandler = (): MessageHandler | null => self.onmessage as MessageHandler | null;
    const worker = {
        postMessage: (command: BridgeMessage) => {
            bridge.commands.push(command);
            if (!bridge.loseCommand(command)) workerHandler()?.({ data: command } as MessageEvent<unknown>);
        },
        terminate: vi.fn(),
        onmessage: null,
    };
    Object.assign(proxy, { worker, isInitialized: true });
    workerHandler()?.({ data: { type: 'init', scale: SCALE } } as MessageEvent<unknown>);
    return bridge;
};
