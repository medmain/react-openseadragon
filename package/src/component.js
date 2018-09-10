import React from 'react';
import PropTypes from 'prop-types';

import {loadOpenSeadragon} from './loader';

export class OpenSeadragon extends React.Component {
  static propTypes = {
    tileSources: PropTypes.string.isRequired,
    showNavigationControl: PropTypes.bool,
    showNavigator: PropTypes.bool,
    navigatorPosition: PropTypes.string,
    style: PropTypes.object
  };

  id = String(Math.round(Math.random() * 1000000000));

  async componentDidMount() {
    const {tileSources, showNavigationControl, showNavigator, navigatorPosition} = this.props;

    const OpenSeadragon = await loadOpenSeadragon();

    this.instance = OpenSeadragon({
      id: this.id,
      tileSources,
      showNavigationControl,
      showNavigator,
      navigatorPosition
    });
  }

  render() {
    const {style} = this.props;
    return <div id={this.id} style={style} />;
  }
}
