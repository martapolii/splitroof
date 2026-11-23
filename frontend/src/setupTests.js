import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// React Router needs these and jsdom doesn't have them
Object.assign(globalThis, { TextDecoder, TextEncoder });
