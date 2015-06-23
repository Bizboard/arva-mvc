/**
 * Created by mysim1 on 16/02/15.
 */

import FlexScrollView   from 'famous-flex/src/FlexScrollView';
import _                from 'lodash';


export default class DataBoundScrollView extends FlexScrollView {

    constructor(OPTIONS = {}) {

        // if no default for autoPipeEvents, have it set to true
        if (OPTIONS.autoPipeEvents === undefined) {
            OPTIONS.autoPipeEvents = true;
        }
        if (OPTIONS.dataSource === undefined) {
            OPTIONS.dataSource = [];
        }
        super(OPTIONS);

        // if no direction given set default to ascending order
        if (!this.options.sortingDirection) {
            this.options.sortingDirection = 'ascending';
        }

        this.isGrouped = this.options.groupBy != null;
        this.isDescending = this.options.sortingDirection === 'descending';

        /* If present in options.headerTemplate or options.placeholderTemplate, we build the header and placeholder elements. */
        this._addHeader();
        this._addPlaceholder();

        if (this.options.dataStore) {
            this._bindDataSource(this.options.dataStore);
        } else {
            console.log('No DataSource was set.');
        }
    }

    _findGroup(groupId) {
        return _.findIndex(this._dataSource, function (surface) {
            return surface.groupId === groupId;
        });
    }

    _findNextGroup(fromIndex) {
        let dslength = this._dataSource.length;
        for (let pos = fromIndex; pos < dslength; pos++) {
            if (this._dataSource[pos].groupId) {
                return pos;
            }
        }

        return this._dataSource.length - 1;
    }


    _getGroupByValue(child) {
        let groupByValue = '';
        if (typeof this.options.groupBy === 'function') {
            groupByValue = this.options.groupBy(child);
        } else if (typeof this.options.groupBy === 'string') {
            groupByValue = this.options.groupBy;
        }
        return groupByValue;
    }

    _addGroupItem(groupByValue) {
        let newSurface = this.options.groupTemplate(groupByValue);
        newSurface.groupId = groupByValue;

        if (this.isDescending) {
            let insertIndex = this.header ? 1 : 0;
            this.insert(insertIndex, newSurface);
            return insertIndex;
        } else {
            let insertIndex = this._dataSource.length - 1;
            this.insert(insertIndex, newSurface);
            return insertIndex;
        }
    }

    _getGroupItemIndex(child) {
        let groupByValue = this._getGroupByValue(child);
        let groupIndex = this._findGroup(groupByValue);
        if (groupIndex > -1) {
            return groupIndex;
        } else {
            return this._addGroupItem(groupByValue);
        }
    }

    _getInsertIndex(child) {
        /* If we're using groups, find the item index of the group this item belongs to. If */
        if (this.isGrouped) {
            return this._getGroupItemIndex(child);
        }

        /* If we're using a header, that will be the first index, so the first index we can use is 1 instead of 0. */
        let firstIndex = this.header ? 0 : 1;

        /* Return the first or last position, depending on the sorting direction. */
        return this.isDescending ? firstIndex : this._dataSource.length - 1;
    }

    _addItem(child) {
        this._removePlaceholder();

        let insertIndex = this._getInsertIndex(child);
        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        newSurface.on('click', function () {
            this._eventOutput.emit('child_click', {renderNode: newSurface, dataObject: child});
        }.bind(this));

        if (this.isGrouped) {
            if (this.isDescending) {
                insertIndex++;
            } else {
                insertIndex = this._findNextGroup(insertIndex) + 1;
            }
        }

        this.insert(insertIndex, newSurface);
    }


    _replaceItem(child) {

        let index = this._getDataSourceIndex(child.id);

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        this.replace(index, newSurface);
    }


    _removeItem(child) {
        let index = _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === child.id;
        });

        if (index > -1) {
            this.remove(index);
        }

        /* The amount of items in the dataSource is subtracted with a header if present, to get the total amount of actual items in the scrollView. */
        let itemCount = this._dataSource.length - (this.header ? 1 : 0);
        if (itemCount === 0) {
            this._addPlaceholder();
        }
    }


    _moveItem(oldId, prevChildId = null) {

        let oldIndex = this._getDataSourceIndex(oldId);
        let previousSiblingIndex = this._getNextVisibleIndex(prevChildId);

        if (oldIndex !== previousSiblingIndex) {
            this.move(oldIndex, previousSiblingIndex);
        }
    }

    _addHeader() {
        if (this.options.headerTemplate && !this.header) {
            this.header = this.options.headerTemplate();
            this.insert(0, this.header);
        }
    }

    _addPlaceholder() {
        if (this.options.placeholderTemplate && !this.placeholder) {
            let insertIndex = this.header ? 1 : 0;
            this.placeholder = this.options.placeholderTemplate();
            this.placeholder.dataId = '_placeholder';
            this.insert(insertIndex, this.placeholder);
        }
    }

    _removePlaceholder() {
        if (this.placeholder) {
            this._removeItem(this.placeholder);
        }
    }

    _bindDataSource() {

        if (!this.options.dataStore || !this.options.itemTemplate) {
            console.log('Datasource and template should both be set.');
            return;
        }

        if (!this.options.template instanceof Function) {
            console.log('Template needs to be a function.');
            return;
        }

        this.options.dataStore.on('child_added', function (child) {

            if (!this.options.dataFilter ||
                (typeof this.options.dataFilter === 'function' &&
                this.options.dataFilter(child))) {

                this._addItem(child);
            }

        }.bind(this));


        this.options.dataStore.on('child_changed', function (child, previousSibling) {

            let changedItem = this._getDataSourceIndex(child.id);

            if (this._dataSource && changedItem < this._dataSource.length) {

                if (this.options.dataFilter &&
                    typeof this.options.dataFilter === 'function' && !this.options.dataFilter(child)) {
                    this._removeItem(child);
                } else {
                    if (changedItem === -1) {
                        this._addItem(child);
                        this._moveItem(child.id, previousSibling);
                    } else {
                        this._replaceItem(child);
                        this._moveItem(child.id, previousSibling);
                    }
                }
            }
        }.bind(this));


        this.options.dataStore.on('child_moved', function (child, previousSibling) {
            let current = this._getDataSourceIndex(child.id);
            let previous = this._getDataSourceIndex(previousSibling);
            this._moveItem(current, previous);
        }.bind(this));


        this.options.dataStore.on('child_removed', function (child) {
            this._removeItem(child);

        }.bind(this));
    }


    _getDataSourceIndex(id) {
        return _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === id;
        });
    }


    _getNextVisibleIndex(id) {

        let viewIndex = this._getDataSourceIndex(id);
        if (viewIndex === -1) {
            let modelIndex = _.findIndex(this.options.dataStore, function (model) {
                return model.id === id;
            });

            if (modelIndex === 0 || modelIndex === -1) {
                return this.isDescending ? this._dataSource ? this._dataSource.length - 1 : 0 : 0;
            } else {
                let nextModel = this.options.dataStore[this.isDescending ? modelIndex + 1 : modelIndex - 1];
                let nextIndex = this._getDataSourceIndex(nextModel.id);
                if (nextIndex > -1) {

                    let newIndex = this.isDescending ? nextIndex === 0 ? 0 : nextIndex - 1 :
                                   this._dataSource.length === nextIndex + 1 ? nextIndex : nextIndex + 1;

                    return newIndex;
                } else {
                    return this._getNextVisibleIndex(nextModel.id);
                }
            }
        } else {
            let newIndex = this.isDescending ? viewIndex === 0 ? 0 : viewIndex - 1 :
                           this._dataSource.length === viewIndex + 1 ? viewIndex : viewIndex + 1;

            return newIndex;
        }
    }
}