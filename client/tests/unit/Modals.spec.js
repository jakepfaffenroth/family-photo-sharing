import { expect, should } from 'chai';
should();
const jestExpect = global.expect;
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import Home from '@/views/Home';
import HomeModalShare from '@/components/HomeModalShare';
import { nextTick, h } from 'vue';
import {
  setMountOptions,
  store,
  router,
  mockAxios,
  setCookies
} from '../setup/jest.setup.js';

describe('basic modal functionality', () => {
  let wrapper;

  beforeEach(async () => {
    await store.dispatch('getOwnerData', {
      id: 'mockOwnerId',
      userType: 'owner'
    });
    setCookies();
    router.push('/');
    await router.isReady();
    wrapper = mount(
      Home,
      setMountOptions({
        stubs: {
          HomeGallery: true,
          HomeUploader: true
        },
        props: { userType: 'owner' },
        data: {
          visibleModal: null
        }
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

describe('share modal', () => {
  let wrapper;

  beforeEach(async () => {
    setCookies();
    router.push('/');
    await router.isReady();
    await store.dispatch('getOwnerData', {
      id: 'mockOwnerId',
      userType: 'owner'
    });
    wrapper = mount(
      Home,
      setMountOptions({
        stubs: {
          HomeGallery: true,
          HomeUploader: true
        },
        props: { userType: 'owner' },
        data: {
          // visibleModal: null
        }
      })
    );
  });

  afterEach(async () => {
    store.dispatch('RESET_STATE');
    wrapper.unmount();
    // mockAxios.reset();
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('correct share url is in share modal', async () => {
    await wrapper.find('[data-test="menuBtn"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-test="openShareModalBtn"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-test="homeModal"]').exists()).to.be.true;

    expect(wrapper.find('[data-test="shareUrl"]').text()).to.include(
      'localhost:3400/mockGuestId/guest'
    );
  });

  test('share modal copies text to clipboard', async () => {
    let copiedText;
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    Object.assign(navigator, {
      clipboard: {
        writeText: x => {
          copiedText = x;
        }
      }
    });
    jest.spyOn(navigator.clipboard, 'writeText');

    router.push('/');
    await router.isReady();
    const wrapper = mount(HomeModalShare, {
      global: {
        plugins: [router, store],
        provide: {
          toast: () => jest.fn(),
          NUKE: () => jest.fn(),
          sortImages: () => jest.fn()
        },
        stubs: {
          HomeGallery: true,
          HomeUploader: true
        }
      },
      props: {
        userType: 'owner'
      },
      data() {
        return {
          visibleModal: 'HomeModalShare',
          imgInfo: null
        };
      }
    });

    await wrapper.find('[data-test="copyBtn"]').trigger('click');

    expect(copiedText).to.equal(wrapper.vm.shareUrl);

    jest.runAllTimers();

    jestExpect(navigator.clipboard.writeText).toBeCalledTimes(1);
    jestExpect(setTimeout).toBeCalledTimes(1);
    jestExpect(setTimeout).toBeCalledWith(jestExpect.any(Function), 10000);
  });
});
