# Sensor, UAV, and Controller Tradespace Dataset

Generated on 2026-04-29. This extension compares two sensor classes, two UAV classes, and two controller classes as an 8-alternative full-factorial tradespace.

## Files

- `sensor_uav_controller_components.csv`: component-level source facts and assumptions.
- `sensor_uav_controller_tradespace.csv`: all 2x2x2 architecture combinations with weighted scores.

## Alternatives

- Sensors: LWIR thermal camera module; 3D scanning lidar.
- UAVs: heavy-lift multirotor; VTOL fixed-wing mapper.
- Controllers: PID controller; model predictive controller.

## Scoring

`tradespace_score` is a normalized 0-100 decision-support score. Higher is better. Integration complexity is included as a penalty. The weighted factors are coverage, sensing, autonomy/constraint handling, payload margin, environmental fit, affordability, and maturity. Affordability, integration complexity, and several mission-fit values are ordinal engineering estimates derived from the representative source facts, not vendor-quoted prices.

Current top-ranked architecture: `arch_04` with LWIR thermal camera module, VTOL fixed-wing mapper, and Model predictive controller; score 78.8.

## Source Keys

- `flir_boson`: Teledyne FLIR Boson product page: LWIR camera module, resolutions, SWaP, power, pixel pitch, sensitivity, radiometry.
- `ouster_os1`: Ouster OS1 product page: 200 m max range, 45 deg vertical FOV, 128 channels, 5.2M points/s, 20 Hz, IP68/IP69K.
- `dji_matrice_350`: DJI Matrice 350 RTK support specs: max flight time, payload, speed, wind resistance, IP rating, RTK accuracy.
- `wingtraone_gen_ii`: WingtraOne technical specifications: VTOL type, payload, flight time, wind resistance, coverage, accuracy, IP54.
- `ni_pid`: NI PID theory article: PID as common industrial control algorithm with simplicity and robust performance.
- `mathworks_mpc`: MathWorks control guidance: MPC predicts future outputs and solves constrained optimization problems.

## Direct Source URLs

- Teledyne FLIR Boson: https://oem.flir.com/en-150/products/boson/
- Ouster OS1: https://ouster.com/products/hardware/os1-lidar-sensor
- DJI Matrice 350 RTK specs: https://www.dji.com/support/product/matrice-350-rtk
- WingtraOne technical specifications: https://wingtra.com/mapping-drone-wingtraone/technical-specifications/
- NI PID theory: https://www.ni.com/en/shop/labview/pid-theory-explained.html
- MathWorks MPC/PID constraints guidance: https://www.mathworks.com/help/slcontrol/ug/improve-pid-to-handle-plant-constraints.html

## Caveats

This table is intended for early tradespace analysis. Replace ordinal scores with program-specific costs, payload interfaces, regulatory constraints, compute hardware limits, and mission performance simulations before source selection or procurement.
