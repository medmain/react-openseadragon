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
    crossOriginPolicy: PropTypes.string,
    debugMode: PropTypes.bool,
    children: PropTypes.node
  };

  static defaultProps = {
    showNavigator: false,
    style: {},
    debugMode: false
  };

  fullyLoaded = false;

  id = String(Math.round(Math.random() * 1000000000));

  elements = new Map();

  async componentDidMount() {
    const {
      tileSources,
      showNavigationControl,
      showNavigator,
      navigatorPosition,
      gestureSettingsMouse,
      onFullyLoaded,
      crossOriginPolicy = false,
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
      crossOriginPolicy,
      debugMode
    });

    this.instance.innerTracker.keyHandler = null; // Disable `w`, `a`, `s` and `d` pan shortcuts

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

    this.elements.clear();
  }

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

  addOverlay(element, location) {
    if (location) {
      this.instance.addOverlay({element, location});
    } else {
      const homeBounds = this.instance.world.getHomeBounds();
      this.instance.addOverlay(
        element,
        new this.OSD.Rect(0, 0, homeBounds.width, homeBounds.height)
      );
    }
  }

  removeOverlay(element) {
    this.instance.removeOverlay(element);
  }

  createMouseTracker(params) {
    return new this.OSD.MouseTracker(params);
  }

  convertImagePointToScreenPoint = point => {
    const {viewport} = this.instance;

    const imagePoint = new this.OSD.Point(point.x, point.y);
    const {x, y} = viewport.imageToViewerElementCoordinates(imagePoint);

    return {x, y};
  };

  addDragHandler(dragHandler) {
    this.originalDragHandler = this.instance.innerTracker.dragHandler;

    this.instance.innerTracker.dragHandler = event => {
      const {x, y} = event.position;
      const viewerPoint = new this.OSD.Point(x, y);
      const point = this.instance.viewport.viewerElementToImageCoordinates(viewerPoint);
      const result = dragHandler({point, event});
      const eventConsumed = result !== false;
      if (!eventConsumed) {
        this.originalDragHandler(event); // propagate the event
      }
    };
  }

  removeDragHandler() {
    this.instance.innerTracker.dragHandler = this.originalDragHandler;
  }

  addDragEndHandler(dragEndHandler) {
    this.originalDragEndHandler = this.instance.innerTracker.dragEndHandler;

    this.instance.innerTracker.dragEndHandler = event => {
      const result = dragEndHandler({event});
      const eventConsumed = result !== false;
      if (!eventConsumed) {
        this.originalDragEndHandler(event); // propagate the event
      }
    };
  }

  removeDragEndHandler() {
    this.instance.innerTracker.dragEndHandler = this.originalDragEndHandler;
  }

  render() {
    const {style} = this.props;

    return (
      <React.Fragment>
        <div id={this.id} style={style} />
        <OpenSeadragonContext.Provider value={this}>
          {this.renderChildren()}
        </OpenSeadragonContext.Provider>
      </React.Fragment>
    );
  }

  renderChildren() {
    const {children} = this.props;

    if (this.instance && children) {
      return React.Children.map(children, child => {
        if (child) {
          const element = this.getElement(child.key);

          element.style['pointer-events'] = 'none';
          return ReactDOM.createPortal(React.cloneElement(child, {element}), element);
        }
      });
    }

    return null;
  }

  getElement(key) {
    const id = this.getOverlayId(key);
    let element = this.elements.get(id);

    if (element) {
      return element;
    }

    element = document.createElement('div');
    element.id = id;

    this.elements.set(id, element);

    return element;
  }

  getOverlayId(key) {
    return `Overlay${key}`;
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
