import React from 'react';
import PropTypes from 'prop-types';

import {withOpenSeadragon} from './main';

@withOpenSeadragon
export class Overlay extends React.Component {
  static propTypes = {
    element: PropTypes.instanceOf(HTMLElement).isRequired,
    x: PropTypes.number,
    y: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    style: PropTypes.object,
    children: PropTypes.node,
    openSeadragon: PropTypes.object.isRequired
  };

  componentDidMount() {
    const {openSeadragon, element, x, y, width, height, style} = this.props;

    if (style) {
      Object.assign(element.style, style);
    }

    openSeadragon.addOverlay(element, {x, y, width, height});
  }

  componentWillUnmount() {
    const {openSeadragon, element} = this.props;

    openSeadragon.removeOverlay(element);
  }

  render() {
    return this.props.children;
  }
}
