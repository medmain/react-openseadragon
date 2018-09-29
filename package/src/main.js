import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import hoistStatics from 'hoist-non-react-statics';

import {loadOpenSeadragon} from './loader';

export const OpenSeadragonContext = React.createContext();

export class OpenSeadragon extends React.Component {
  static propTypes = {
    tileSources: PropTypes.string.isRequired,
    showNavigationControl: PropTypes.bool,
    showNavigator: PropTypes.bool,
    navigatorPosition: PropTypes.string,
    gestureSettingsMouse: PropTypes.object,
    onFullyLoaded: PropTypes.func,
    onOpen: PropTypes.func,
    onResize: PropTypes.func,
    onRotate: PropTypes.func,
    onUpdateViewport: PropTypes.func,
    onZoom: PropTypes.func,
    style: PropTypes.object,
    debugMode: PropTypes.bool,
    children: PropTypes.node
  };

  static defaultProps = {
    showNavigator: false,
    style: {},
    debugMode: false
  };

  async componentDidMount() {
    const {
      tileSources,
      showNavigationControl,
      showNavigator,
      navigatorPosition,
      gestureSettingsMouse,
      onFullyLoaded,
      debugMode
    } = this.props;

    this.OSD = await loadOpenSeadragon();

    this.instance = new this.OSD({
      id: this.id,
      tileSources,
      showNavigationControl,
      showNavigator,
      navigatorPosition,
      gestureSettingsMouse,
      debugMode
    });

    this.instance.addHandler('open', this.onOpen);
    this.instance.addHandler('resize', this.onResize);
    this.instance.addHandler('rotate', this.onRotate);
    this.instance.addHandler('update-viewport', this.onUpdateViewport);
    this.instance.addHandler('zoom', this.onZoom);

    if (onFullyLoaded) {
      this.instance.world.addHandler('add-item', this.onAddItem);
    }
  }

  componentWillUnmount() {
    this.instance.world.removeAllHandlers();
    this.instance.removeAllHandlers();
  }

  fullyLoaded = false;

  id = String(Math.round(Math.random() * 1000000000));

  isFullyLoaded() {
    const {world} = this.instance;
    const count = world.getItemCount();
    for (let i = 0; i < count; i++) {
      const tiledImage = world.getItemAt(i);
      if (!tiledImage.getFullyLoaded()) {
        return false;
      }
    }
    return true;
  }

  onFullyLoadedChange = () => {
    const {onFullyLoaded} = this.props;
    const newFullyLoaded = this.isFullyLoaded();
    if (newFullyLoaded !== this.fullyLoaded) {
      this.fullyLoaded = newFullyLoaded;

      onFullyLoaded();
    }
  };

  onAddItem = ({item}) => {
    item.addHandler('fully-loaded-change', this.onFullyLoadedChange);
  };

  onOpen = event => {
    const {onOpen} = this.props;
    if (onOpen) {
      onOpen(event);
    }
    this.forceUpdate();
  };

  onUpdateViewport = event => {
    const {onUpdateViewport} = this.props;
    if (onUpdateViewport) {
      onUpdateViewport(event);
    }
  };

  onZoom = event => {
    const {onZoom} = this.props;
    if (onZoom) {
      onZoom(event);
    }
  };

  onRotate = event => {
    const {onRotate} = this.props;
    if (onRotate) {
      onRotate(event);
    }
  };

  onResize = event => {
    const {onResize} = this.props;
    if (onResize) {
      onResize(event);
    }
  };

  addOverlay(element, {x, y, width, height} = {}) {
    let location;

    if (x !== undefined && y !== undefined) {
      if (width !== undefined && height !== undefined) {
        location = new this.OSD.Rect({x, y, width, height});
      } else {
        location = new this.OSD.Point({x, y});
      }

      this.instance.addOverlay({element, location});
    } else {
      const homeBounds = this.instance.world.getHomeBounds();
      location = new this.OSD.Rect(0, 0, homeBounds.width, homeBounds.height);
    }

    this.instance.addOverlay(element, location);
  }

  removeOverlay(element) {
    this.instance.removeOverlay(element);
  }

  createMouseTracker(params) {
    return new this.OSD.MouseTracker(params);
  }

  render() {
    const {style, children} = this.props;

    return (
      <React.Fragment>
        <div id={this.id} style={style} />
        <OpenSeadragonContext.Provider value={this}>
          {this.instance &&
            children &&
            React.Children.map(children, child => {
              if (child) {
                const element = document.createElement('div');
                element.style['pointer-events'] = 'none';
                return ReactDOM.createPortal(React.cloneElement(child, {element}), element);
              }
            })}
        </OpenSeadragonContext.Provider>
      </React.Fragment>
    );
  }
}

export const withOpenSeadragon = Component => {
  const C = props => {
    return (
      <OpenSeadragonContext.Consumer>
        {openSeadragon => <Component {...props} openSeadragon={openSeadragon} />}
      </OpenSeadragonContext.Consumer>
    );
  };

  C.displayName = `withOpenSeadragon(${Component.displayName || Component.name})`;
  C.WrappedComponent = Component;

  return hoistStatics(C, Component);
};
