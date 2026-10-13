// mongodb-memory-server descarga por defecto la última versión estable de
// mongod, compilada para la versión más reciente de macOS — incompatible con
// versiones de macOS más antiguas (símbolo de libc++ ausente). Se fija una
// versión LTS compatible con un rango amplio de sistemas.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION ?? "6.0.14";
