import _PropTypes from 'prop-types';
import type { a } from './other';
import type b from './other';

class Foo extends React.Component {
  props: {
    a: a;
    b: b;
  };
  static propTypes = {
    a: _PropTypes.instanceOf(a).isRequired,
    b: _PropTypes.instanceOf(b).isRequired
  };
}
