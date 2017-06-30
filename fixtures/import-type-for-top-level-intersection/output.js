import _PropTypes from 'prop-types';
import type a from './other';

class Foo extends React.Component {
  props: a & { bar: boolean };
  static propTypes = {
    foo: _PropTypes.bool.isRequired,
    bar: _PropTypes.bool.isRequired
  };
}
