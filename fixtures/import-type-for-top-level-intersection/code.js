import type a from './other';

class Foo extends React.Component {
  props: a & { bar: boolean };
}
