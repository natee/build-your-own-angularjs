/* jshint globalstrict: true */
'use strict';

/**
 * 检测`obj`是否是window对象
 * @param  {object}   obj 
 * @return {Boolean}      true：是window对象
 * @author zhaoke@haizhi.com
 * @date   2016-10-20
 */
function isWindow(obj) {
    return obj && obj.window === obj;
}

var isArray = Array.isArray;

function isString(value) {
    return typeof value === 'string';
}

function isNumber(value) {
    return typeof value === 'number'; 
}

function isObject(value) {
  // http://jsperf.com/isobject4
  return value !== null && typeof value === 'object';
}

/**
 * 是否是类数组对象
 * @param  {[type]}   obj [description]
 * @return {Boolean}      [description]
 */
function isArrayLike(obj) {
    if (obj === null || isWindow(obj) || obj === undefined) {
        return false;
    }

    if (isArray(obj) || isString(obj)) {
        return true;
    }

    var length = obj.length;
    return isNumber(length);

}
