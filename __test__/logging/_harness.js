module.exports = {
  requireLib: p => require(`../../lib/${p}`),
  requireRoot: p => require(`../../${p}`),
  mockFactory: {
    Transport: () => ({
      pushLine: jest.fn()
    }),
    Config: () => jest.genMockFromModule("../../lib/config/Config")
  }
};
