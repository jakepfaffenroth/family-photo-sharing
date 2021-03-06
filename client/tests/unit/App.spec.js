import { expect, should } from 'chai';
should();
import { flushPromises, mount } from '@vue/test-utils';
import App from '@/App';
// import Home from '@/views/Home';
// import Account from '@/views/Account';
import { nextTick } from 'vue';
// import { createRouter, createWebHistory } from 'vue-router';
// import { createStore } from 'vuex';
import {
  setMountOptions,
  store,
  router,
  mockAxios,
  setCookies
} from '../setup/jest.setup.js';

// const initialState = Object.assign({}, store.state);
// console.log('initialState:', initialState);
// process.env.VUE_APP_SERVER = 'http://localhost:3400';

// const router = createRouter({
//   history: createWebHistory(),
//   routes: [
//     {
//       name: 'home',
//       path: '/',
//       component: Home,
//       props: true
//     },
//     {
//       name: 'account',
//       path: '/account',
//       component: Account,
//       props: true
//     }
//   ]
// });
// import store from '@/store';
// import store from '../store';
// const storex = createStore({
//   state: {
//     ownerStore: {
//       owner: {
//         ownerId: 'mockOwnerId',
//         username: 'alice',
//         firstName: 'Alice',
//         lastName: 'Doe',
//         guestId: 'testGuestId'
//       },
//       ownerIdCookie: '',
//       guestIdCookie: ''
//     },
//     planStore: {
//       usage: { kb: 10, mb: 20, gb: 30 },
//       planDetails: { plan: 'Basic', paymentMethod: 'Visa •••• 4242' }
//     },
//     imageStore: {
//       images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }],
//       albums: []
//     }
//   },
//   getters: {
//     ownerId: () => 'mockOwnerId',
//     images: state => state.imageStore.images,
//     planDetails: state => state.planStore.planDetails,
//     storageValue: () => 20,
//     usageValue: () => ({ num: 50, unit: 'mb' }),
//     quota: () => 2000,
//     usageBarColor: () => 'green-400',
//     usageBarWidth: () => 'width: ' + 2 + '%'
//   },
//   actions: {
//     saveIdCookies() {},
//     getOwnerData() {},
//     getPlanDetails() {}
//   }
// });

// jest.mock('reconnecting-websocket');

// const mountOptions = {
//   global: {
//     plugins: [router, store],
//     provide: {
//       toast: () => null,
//       NUKE: () => null,
//       sortImages: () => null
//     },
//     stubs: {
//       HomeMenuOwner: true,
//       HomeGallery: true,
//       HomeUploader: true,
//       AccountPlanPickerButton: true
//     }
//   },
//   data() {
//     return {
//       toast: jest.fn(() => {
//         open: () => {};
//       })
//     };
//   }
// };

// const setCookies = () => {
//   Object.defineProperty(window.document, 'cookie', {
//     writable: true,
//     value: 'ownerId=mockOwnerId'
//   });
// };

// mockAxios.onAny().reply(config => {
//   console.log('config.url:', config.url);
//   if (config.url.includes('get-usage')) {
//     return [200, { kb: 10, mb: 20, gb: 30 }];
//   } else if (config.url.includes('check-session')) {
//     return [
//       200,
//       {
//         owner: {
//           ownerId: 'mockOwnerId',
//           username: 'alice',
//           firstName: 'Alice',
//           lastName: 'Doe',
//           guestId: 'mockGuestId',
//           plan: 'Basic',
//           quota: 2000
//         },
//         images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }],
//         albums: [],
//         isLoggedIn: true
//       }
//     ];
//   } else if (config.url.includes('retrieve-payment-method')) {
//     return [
//       200,
//       {
//         plan: 'Basic',
//         paymentMethod: 'Visa **** mockCard'
//       }
//     ];
//   } else {
//     return [500];
//   }
// });

describe('Initialization', () => {
  let wrapper;

  beforeEach(async () => {
    setCookies();
    router.push('/');
    await router.isReady();
    wrapper = mount(
      App,
      setMountOptions({
        stubs: { HomeMenuOwner: true, HomeGallery: true, HomeUploader: true }
      })
    );
  });

  afterEach(async () => {
    store.dispatch('RESET_STATE');
    await router.replace('/');
    await router.isReady();
    wrapper.unmount();
    // mockAxios.reset();
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('renders Home component', async () => {
    const home = wrapper.findComponent({ name: 'Home' });
    expect(home.exists()).to.be.true;
  });

  test('renders owner menu', async () => {
    // console.log('wrapper.html():', wrapper.html());
    await nextTick();
    expect(wrapper.text()).to.include('Upload Files');
  });
});

// describe('Routing', () => {
//   let wrapper;

//   beforeEach(async () => {
//     setCookies();
//     router.push('/');
//     await router.isReady();
//     wrapper = mount(App, mountOptions);
//   });

//   afterEach(async () => {
//     await router.replace('/');
//     await router.isReady();
//     wrapper.unmount();
//     // mockAxios.reset();
//     jest.resetModules();
//     jest.clearAllMocks();
//   });

//   // Object.defineProperty(window.document, 'cookie', {
//   //   writable: true,
//   //   value: 'ownerId=testOwnerId'
//   // });

//   // const wrapper = mount(App, mountOptions);

//   test('router navigates to Account view', async () => {
//     router.push('/account');
//     await router.isReady();
//     await flushPromises();

//     expect(wrapper.findComponent({ name: 'Account' }).exists()).to.be.true;
//   });

//   // test('menu btn navigates to Account view', async () => {
//   //   await wrapper.find('[data-test="menuBtn"]').trigger('click');
//   //   await wrapper.find('[data-test="accountBtn"]').trigger('click');
//   //   await flushPromises();

//   //   expect(wrapper.findComponent({ name: 'Account' }).exists()).to.be.true;
//   // });

//   // test('menu btn navigates to Get More Storage', async () => {
//   //   await wrapper.find('[data-test="menuBtn"]').trigger('click');
//   //   await wrapper.find('[data-test="getMoreStorageBtn"]').trigger('click');
//   //   await flushPromises();

//   //   expect(wrapper.text()).to.include('Change your plan');
//   // });
// });

// test('logout deletes cookie', async () => {
//   // delete window.location;
//   // window.location = location;
//   Object.defineProperty(window, 'location', {
//     value: {
//       assign: jest.fn(),
//       replace: jest.fn(),
//       reload: jest.fn(),
//       search: jest.fn()
//     },
//     writable: true
//   });
//   // mockAxios.onGet().reply(200);
//   // mockAxios.onPost().reply(200, {
//   //   owner: { ownerId: 'testOwnerId' },
//   //   images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }]
//   // });

//   setCookies();
//   const wrapper = mount(App, mountOptions);
//   router.push('/');
//   await router.isReady();
//   await nextTick();
//   await wrapper.find('[data-test="menuBtn"]').trigger('click');
//   await wrapper.find('[data-test="logoutBtn"]').trigger('click');

//   expect(window.document.cookie).to.not.include('ownerId=testOwnerId');
// });
