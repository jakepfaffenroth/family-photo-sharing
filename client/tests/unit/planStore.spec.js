import { expect, should } from 'chai';
should();
import {
  setMountOptions,
  store,
  router,
  mockAxios,
  setCookies
} from '../setup/jest.setup.js';

describe('getters', () => {
  afterEach(() => {
    store.dispatch('RESET_STATE');
  });

  test.each([
    [0, 2000, 0],
    [500, 2000, 25],
    [500, 10000, 5],
    [0.5, 2000, 0.025]
  ])(
    'storagePercentage - %smb usage and %smb quota should return %s% usage',
    (value, quota, expected) => {
      store.state.planStore.usage = {
        kb: value * 1000,
        mb: value,
        gb: value / 1000
      };
      store.state.ownerStore.owner = { quota: quota };

      const storagePercentage = store.getters.storagePercentage;

      expect(storagePercentage).to.equal(expected);
    }
  );

  test.each([
    [-10, 'error'],
    [0, '0KB'],
    [0.05, '50KB'],
    [0.999, '999KB'],
    [1, '1MB'],
    [1.5, '1.5MB'],
    [999, '999MB'],
    [1000, '1GB'],
    [1500, '1.5GB']
  ])('usageValue - %smb should return %s', (value, expected) => {
    store.state.planStore.usage = {
      kb: value * 1000,
      mb: value,
      gb: value / 1000
    };
    const usageValue = store.getters.usageValue;
    const text = usageValue.num + usageValue.unit;

    expect(text).to.equal(expected);
  });

  test.each([
    [-10, '0%'],
    [0, '0%'],
    [1, '2%'],
    [2, '2%'],
    [2.1, '2.1%'],
    [100, '100%'],
    [101, '101%']
  ])(
    'usageBarWidth - %s% storagePercentage should return "width: %s"',
    (value, expected) => {
      store.state.planStore.usage = { mb: value / 100 };
      store.state.ownerStore.owner = { quota: 1 };

      const usageBarWidth = store.getters.usageBarWidth;

      expect(usageBarWidth).to.equal('width: ' + expected);
    }
  );

  test.each([
    [-10, 'green-400'],
    [0, 'green-400'],
    [1, 'green-400'],
    [2, 'green-400'],
    [2.1, 'green-400'],
    [40, 'orange-400'],
    [60, 'orange-400'],
    [100, 'red-500'],
    [101, 'red-500']
  ])(
    'usageBarColor - %s% storagePercentage should return "%s"',
    (value, expected) => {
      store.state.planStore.usage = { mb: value / 100 };
      store.state.ownerStore.owner = { quota: 1 };

      const usageBarColor = store.getters.usageBarColor;

      expect(usageBarColor).to.equal(expected);
    }
  );
});

describe('actions', () => {
  afterEach(() => {
    store.dispatch('RESET_STATE');
  });

  test.each(['mockOwnerId', null])('getPlanActions', async ownerId => {
    mockAxios.onPost().reply(config => {
      switch (config.url) {
        case 'undefined/payment/retrieve-payment-method':
          return [200, { plan: 'Premium', paymentMethod: 'mockPaymentMethod' }];
          break;
        case 'undefined/auth/check-session':
          return [
            200,
            { isLoggedIn: true, owner: { ownerId: 'mockOwnerId' }, images: [] }
          ];
          break;
        case 'undefined/user/get-owner':
          return [200, { isLoggedIn: true, images: [] }];
          break;
        case 'undefined/files/get-usage':
          return [
            200,
            {
              usage: { kb: 0, mb: 0, gb: 0 },
              planDetails: {
                plan: 'Premium',
                paymentMethod: 'mockPaymentMethod'
              }
            }
          ];
          break;
        default:
          return [200];
          break;
      }
    });

    store.state.ownerStore.owner = { ownerId: ownerId, isLoggedIn: true };

    await store.dispatch('getPlanDetails');

    expect(store.state.planStore.planDetails.plan).to.equal('Premium');
  });
});
