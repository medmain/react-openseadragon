import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import hoistStatics from 'hoist-non-react-statics';

import {loadOpenSeadragon} from './loader';

export const OpenSeadragonContext = React.createContext();

const CLICK_EVENT_TYPE = 'click';
const MOVE_EVENT_TYPE = 'move';
const DRAG_EVENT_TYPE = 'drag';
const DRAG_END_EVENT_TYPE = 'dragEnd';

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
      debugMode,
      // the default value for `maxImageCacheCount` (200) causes crashes on iOS
      // `Total canvas memory use exceeds the maximum limit (224 MB).`
      maxImageCacheCount: 50
    });

    this.instance.innerTracker.keyHandler = null; // Disable `w`, `a`, `s` and `d` pan shortcuts

    this._initializeMouseEventHandlers();

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

  convertScreenPointToImagePoint = point => {
    const viewerPoint = new this.OSD.Point(point.x, point.y);
    const {x, y} = this.instance.viewport.viewerElementToImageCoordinates(viewerPoint);

    return {x, y};
  };

  // CLICK event
  addClickHandler(handler) {
    this._addMouseEventHandler(CLICK_EVENT_TYPE, handler);
  }

  removeClickHandler(handler) {
    this._removeMouseEventHandler(CLICK_EVENT_TYPE, handler);
  }

  // MOVE event
  addMoveHandler(handler) {
    this._addMouseEventHandler(MOVE_EVENT_TYPE, handler);
  }

  removeMoveHandler(handler) {
    this._removeMouseEventHandler(MOVE_EVENT_TYPE, handler);
  }

  // DRAG...
  addDragHandler(handler) {
    this._addMouseEventHandler(DRAG_EVENT_TYPE, handler);
  }

  removeDragHandler(handler) {
    this._removeMouseEventHandler(DRAG_EVENT_TYPE, handler);
  }

  // ...and DROP events
  addDragEndHandler(handler) {
    this._addMouseEventHandler(DRAG_END_EVENT_TYPE, handler);
  }

  removeDragEndHandler(handler) {
    this._removeMouseEventHandler(DRAG_END_EVENT_TYPE, handler);
  }

  _initializeMouseEventHandlers() {
    const tracker = this.instance.innerTracker;

    // Set up a stack of `handler` for each event type
    this.mouseEventHandlers = {
      [CLICK_EVENT_TYPE]: [tracker.clickHandler],
      [MOVE_EVENT_TYPE]: [], // innerTracker.moveHandler is `null` by default
      [DRAG_EVENT_TYPE]: [tracker.dragHandler],
      [DRAG_END_EVENT_TYPE]: [tracker.dragEndHandler]
    };

    tracker.clickHandler = event => {
      this._runMouseEventHandlers(CLICK_EVENT_TYPE, event);
    };
    tracker.moveHandler = event => {
      this._runMouseEventHandlers(MOVE_EVENT_TYPE, event);
    };
    tracker.dragHandler = event => {
      this._runMouseEventHandlers(DRAG_EVENT_TYPE, event);
    };
    tracker.dragEndHandler = event => {
      this._runMouseEventHandlers(DRAG_END_EVENT_TYPE, event);
    };
  }

  _runMouseEventHandlers(type, event) {
    const mouseEventHandlers = this.mouseEventHandlers[type];

    for (let index = mouseEventHandlers.length - 1; index >= 0; index--) {
      const handler = mouseEventHandlers[index];
      const result = handler(event);
      const eventConsumed = result !== false;
      if (eventConsumed) {
        break; // don't propagate to the next handler of the stack if the event is consumed
      }
    }
  }

  _addMouseEventHandler(type, handler) {
    const handlers = this.mouseEventHandlers[type];

    handlers.push(handler);
  }

  _removeMouseEventHandler(type, handler) {
    const handlers = this.mouseEventHandlers[type];

    const index = handlers.findIndex(stackHandler => stackHandler === handler);
    if (index === -1) {
      throw new Error('Unable to remove the mouse event handler, not found in the stack');
    }

    handlers.splice(index, 1);
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
