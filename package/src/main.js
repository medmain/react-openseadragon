import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import hoistStatics from 'hoist-non-react-statics';

import {loadOpenSeadragon} from './loader';

export const OpenSeadragonContext = React.createContext();

const DRAG_EVENT_TYPE = 'drag';
const DRAG_END_EVENT_TYPE = 'dragEnd';
const MOVE_EVENT_TYPE = 'move';
const CLICK_EVENT_TYPE = 'click';

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

  _initializeMouseEventHandlers() {
    const tracker = this.instance.innerTracker;

    // Set up a stack of `{handler, target}` for each event type
    this.mouseEventHandlers = {
      [CLICK_EVENT_TYPE]: [{handler: tracker.clickHandler}],
      [MOVE_EVENT_TYPE]: [], // innerTracker.moveHandler is `null` by default
      [DRAG_EVENT_TYPE]: [{handler: tracker.dragHandler}],
      [DRAG_END_EVENT_TYPE]: [{handler: tracker.dragEndHandler}]
    };

    tracker.clickHandler = event => {
      this._runMouseEventHandlers(event, CLICK_EVENT_TYPE);
    };
    tracker.moveHandler = event => {
      this._runMouseEventHandlers(event, MOVE_EVENT_TYPE);
    };
    tracker.dragHandler = event => {
      this._runMouseEventHandlers(event, DRAG_EVENT_TYPE);
    };
    tracker.dragEndHandler = event => {
      this._runMouseEventHandlers(event, DRAG_END_EVENT_TYPE);
    };
  }

  _runMouseEventHandlers(event, type) {
    const mouseEventHandlers = this.mouseEventHandlers[type];

    for (let index = mouseEventHandlers.length - 1; index >= 0; index--) {
      const {handler, target} = mouseEventHandlers[index];
      if (target && event.originalEvent.target !== target) {
        continue; // ignore the event if the `target` doesn't match
      }
      const result = handler(event);
      const eventConsumed = result !== false;
      if (eventConsumed) {
        break; // don't propagate to the next handler of the stack if the event is consumed
      }
    }
  }

  _addMouseEventHandler(type, handler, target) {
    const handlers = this.mouseEventHandlers[type];

    handlers.push({handler, target});
  }

  _removeMouseEventHandler(type, handler, target) {
    const trackers = this.mouseEventHandlers[type];

    const index = trackers.findIndex(
      tracker => handler === tracker.handler && tracker.target === target
    );
    trackers.splice(index, 1);
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
  addClickHandler(handler, target) {
    this._addMouseEventHandler(CLICK_EVENT_TYPE, handler, target);
  }

  removeClickHandler(handler, target) {
    this._removeMouseEventHandler(CLICK_EVENT_TYPE, handler, target);
  }

  // MOVE event
  addMoveHandler(handler, target) {
    this._addMouseEventHandler(MOVE_EVENT_TYPE, handler, target);
  }

  removeMoveHandler(handler, target) {
    this._removeMouseEventHandler(MOVE_EVENT_TYPE, handler, target);
  }

  // DRAG...
  addDragHandler(handler, target) {
    this._addMouseEventHandler(DRAG_EVENT_TYPE, handler, target);
  }

  removeDragHandler(handler, target) {
    this._removeMouseEventHandler(DRAG_EVENT_TYPE, handler, target);
  }

  // ...and DROP events
  addDragEndHandler(handler, target) {
    this._addMouseEventHandler(DRAG_END_EVENT_TYPE, handler, target);
  }

  removeDragEndHandler(handler, target) {
    this._removeMouseEventHandler(DRAG_END_EVENT_TYPE, handler, target);
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
