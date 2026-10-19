// SW-46: the shared conditional-notice rule lives in the truth kernel so every module
// producer uses the same one; runtime-api code and the page script import it from here.
export {conditionalNotice} from '../../truth-kernel/src/conditional-notice';
