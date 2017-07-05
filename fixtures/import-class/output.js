import _PropTypes from 'prop-types';
import A from './other';

class Foo extends React.Component {
  props: {
    a: A
  };
  static propTypes = {
    a: _PropTypes.instanceOf(A).isRequired
  };
}
