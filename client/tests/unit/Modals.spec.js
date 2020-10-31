import { expect, should } from 'chai';
should();
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/views/Home';
import Account from '@/views/Account';
import BaseDropMenu from '@/components/BaseDropMenu';
import { nextTick, h } from 'vue';
import { createStore } from 'vuex';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
const mockAxios = new MockAdapter(axios);

process.env.VUE_APP_SERVER = 'http://localhost:3400';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      name: 'home',
      path: '/',
      component: Home
    },
    { name: 'account', path: '/account', component: Account }
  ]
});

const store = createStore({
  state: {
    ownerStore: {
      owner: {
        ownerId: 'testOwnerId',
        username: 'alice',
        firstName: 'Alice',
        lastName: 'Doe',
        guestId: 'testGuestId'
      },
      ownerIdCookie: '',
      guestIdCookie: ''
    },
    planStore: { usage: { kb: 0, mb: 0, gb: 0 }, planDetails: null },
    imageStore: {
      images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }]
    }
  },
  getters: {
    ownerId: () => 'testOwnerId',
    storageValue: () => 20,
    usageValue: () => ({ num: 50, unit: 'mb' }),
    quota: () => 2000,
    usageBarColor: () => 'green-400',
    usageBarWidth: () => 'width: ' + 2 + '%'
  },
  actions: {
    saveIdCookies() {},
    getOwnerData() {}
  }
});

const toast = () => null;
const nuke = () => null;
const sortImages = () => null;

describe('basic modal functionality', () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        name: 'home',
        path: '/',
        component: Home
      },
      { name: 'account', path: '/account', component: Account }
    ]
  });

  const store = createStore({
    state: {
      ownerStore: {
        owner: {
          ownerId: 'testOwnerId',
          username: 'alice',
          firstName: 'Alice',
          lastName: 'Doe',
          guestId: 'testGuestId'
        },
        ownerIdCookie: '',
        guestIdCookie: ''
      },
      planStore: { usage: { kb: 0, mb: 0, gb: 0 }, planDetails: null },
      imageStore: {
        images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }]
      }
    },
    getters: {
      ownerId: () => 'testOwnerId',
      storageValue: () => 20,
      usageValue: () => ({ num: 50, unit: 'mb' }),
      quota: () => 2000,
      usageBarColor: () => 'green-400',
      usageBarWidth: () => 'width: ' + 2 + '%'
    },
    actions: {
      saveIdCookies() {},
      getOwnerData() {}
    }
  });

  const toast = () => null;
  const nuke = () => null;
  const sortImages = () => null;

  let wrapper;
  jest.mock('@uppy/dashboard');

  Object.defineProperty(window.document, 'cookie', {
    writable: true,
    value: 'ownerId=testOwnerId'
  });

  mockAxios.onPost().reply(200, {
    owner: { ownerId: 'testOwnerId' },
    images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }]
  });

  beforeEach(async () => {
    router.push('/');
    await router.isReady();
    wrapper = mount(Home, {
      global: {
        plugins: [router, store],
        provide: { toast, nuke, sortImages },
        stubs: {
          HomeGallery: true,
          HomeUploader: true
        }
      },
      props: { userType: 'owner' },
      data() {
        return {
          visibleModal: null,
          imgInfo: null
        };
      }
    });
  });

  afterEach(async () => {
    await router.replace('/');
    await router.isReady();
    wrapper.unmount();
    mockAxios.reset();
    jest.resetModules();
    jest.clearAllMocks();
  });

  test.each([
    'HomeModalShare',
    'HomeModalDeleteImage',
    'HomeModalGuestSubscribe'
  ])('click outside %s modal closes modal', async modalName => {
    if (modalName.includes('GuestSubscribe')) {
      wrapper.setProps({ userType: 'guest' });
    }
    if (modalName.includes('Delete')) {
      wrapper.vm.imgInfo = { fileId: '1' };
    }
    wrapper.vm.visibleModal = modalName;
    await nextTick();
    expect(wrapper.find('[data-test="modal"]').exists()).to.be.true;

    await wrapper.find('[data-test="modalBackdrop"]').trigger('click');
    // await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-test="modal"]').exists()).to.be.false;
  });
});

describe('guest subscribe modal', () => {
  let wrapper;
  jest.mock('@uppy/dashboard');

  Object.defineProperty(window.document, 'cookie', {
    writable: true,
    value: 'ownerId=testOwnerId'
  });

  mockAxios.onPost().reply(200, {
    owner: { ownerId: 'testOwnerId' },
    images: [{ uploadTime: Date.now() }, { uploadTime: Date.now() }]
  });

  beforeEach(async () => {
    router.push('/');
    await router.isReady();
    wrapper = mount(Home, {
      global: {
        plugins: [router, store],
        provide: { toast, nuke, sortImages },
        stubs: {
          HomeGallery: true,
          HomeUploader: true
        }
      },
      props: { userType: 'owner' },
      data() {
        return {
          visibleModal: null
        };
      }
    });
  });

  afterEach(async () => {
    await router.replace('/');
    await router.isReady();
    wrapper.unmount();
    mockAxios.reset();
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('correct share url is in share modal', async () => {
    const menuBtn = wrapper.find('[data-test="menuBtn"]');
    const openShareModalBtn = wrapper.find('[data-test="openShareModalBtn"]');

    await menuBtn.trigger('click');
    await openShareModalBtn.trigger('click');

    expect(wrapper.find('[data-test="homeModal"]').html()).to.include(
      'localhost:3400/testGuestId/guest'
    );
  });
});
