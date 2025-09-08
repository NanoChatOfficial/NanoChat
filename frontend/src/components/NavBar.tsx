const NavBar = () => {
  return (
    <div className="navbar flex bg-base-100 shadow-sm">
      <div className="flex-1">
        <a className="btn btn-ghost text-xl">NanoChat</a>
      </div>
      <a
        className="btn btn-outline btn-accent rounded-full normal-case text-sm"
        href="https://github.com/umutcamliyurt/NanoChat"
      >
        Source
      </a>
    </div>
  );
};

export default NavBar;
