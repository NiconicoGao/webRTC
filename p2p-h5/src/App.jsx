import React from 'react';
import {HashRouter as Router,Route} from 'react-router-dom';
import P2PClient from './p2p/P2PClient';

class App extends React.Component{
    
    render(){
        return <Router>
            <div>
                <Route exact path="/" component={P2PClient}/>
            </div>
        </Router>
    }

}

export default App;