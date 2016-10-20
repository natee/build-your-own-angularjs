# build-your-own-angularjs
AngularJS内部原理讲解。

## 第一部分 作用域

### 作用域和digest

- AngularJS通过$watch和$digest进行脏值检查达到双向绑定的目的
- 脏值检测循环和TTL（time to live）原理进行终止检测
- 通过不同的方式执行digest：直接用$eval和$apply，延时执行用$evalAsync和$$posotDigest
- 异常处理

### 作用域继承

- 如何创建子作用域
通过`Object.create(obj)`进行原型链委托创建子作用域。
- 作用域继承和原生JavaScript原型的关系
- 属性覆盖及其含义
子作用域通过修改父作用域中的对象的属性可以达到同时修改父作用域的值，而修改普通值如：number、string则是创建一个新的。
这个掌握js中引用数据类型（array、object、function）和值数据类型（number、boolean、undfeind、null）后就没多大问题。
建议ngModel中全部通过Obj.xx的形式调用。

- 父作用域中通过递归digest达到执行子作用域中的watch的目的
- $digest和$apply的区别
性能问题，$digest()只会使当前作用域及其子作用域中的watch（包括$evalAsync和$$postDigest）执行，$apply会使rootScope下所有的watch都执行一遍。$evalAsync和$$postDigest同样会使rootScope下的所有watch都执行一遍。

- 独立作用域和普通子作用域的区别
普通子作用域继承了父作用域的所有属性（通过原型链和父作用域关联起来），独立子作用域是一个新的作用域，无法访问父作用域的属性，通过this.$$root存储父作用域。

- 如何销毁一个子作用域
从父作用域中的$$children中移除当前作用域，从而在下次执行digest时将不会执行当前作用域。

### 监听集合
`$watchCollection`和`$watch`的区别：
- 

