const { requireLib } = require("../_harness");

const DatasoleClient = requireLib("runtime/client");

let mockSend, mockOn;

beforeEach(() => {
  mockOn = process.on = jest.fn();
  mockSend = process.send = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("constructable with no arguments.", () => {
  new DatasoleClient();
});
